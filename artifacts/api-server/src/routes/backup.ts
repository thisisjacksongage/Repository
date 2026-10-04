import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  GetBackupResponse,
  RestoreBackupBody,
  RestoreBackupResponse,
} from "@workspace/api-zod";
import {
  contributionsTable,
  db,
  goalsTable,
  resaleItemsTable,
} from "@workspace/db";
import { resaleProfitCents, toDollars } from "../lib/money";

const router: IRouter = Router();

router.get("/backup", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [goals, contributions, items] = await Promise.all([
    db
      .select()
      .from(goalsTable)
      .where(eq(goalsTable.userId, userId))
      .orderBy(desc(goalsTable.createdAt)),
    db
      .select()
      .from(contributionsTable)
      .where(eq(contributionsTable.userId, userId))
      .orderBy(desc(contributionsTable.contributionDate)),
    db
      .select()
      .from(resaleItemsTable)
      .where(eq(resaleItemsTable.userId, userId))
      .orderBy(desc(resaleItemsTable.createdAt)),
  ]);
  const contributionsByGoal = new Map<string, number>();
  for (const contribution of contributions) {
    contributionsByGoal.set(
      contribution.goalId,
      (contributionsByGoal.get(contribution.goalId) ?? 0) + contribution.amountCents,
    );
  }

  res.json(
    GetBackupResponse.parse({
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      goals: goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetCents / 100,
        savedAmount: (contributionsByGoal.get(goal.id) ?? 0) / 100,
        targetDate: goal.targetDate,
        color: goal.color,
        createdAt: goal.createdAt.toISOString(),
      })),
      contributions: contributions.map((contribution) => ({
        id: contribution.id,
        goalId: contribution.goalId,
        amount: contribution.amountCents / 100,
        date: contribution.contributionDate,
        note: contribution.note,
        createdAt: contribution.createdAt.toISOString(),
      })),
      items: items.map((item) => {
        const profitCents = resaleProfitCents(item);
        const soldPrice = toDollars(item.soldPriceCents);
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          brand: item.brand,
          size: item.size,
          status: item.status,
          purchasePrice: item.purchasePriceCents / 100,
          purchaseDate: item.purchaseDate,
          listingPrice: toDollars(item.listingPriceCents),
          soldPrice,
          platform: item.platform,
          platformFee: toDollars(item.platformFeeCents),
          paymentFee: toDollars(item.paymentFeeCents),
          shippingCost: toDollars(item.shippingCostCents),
          otherCosts: toDollars(item.otherCostsCents),
          soldDate: item.soldDate,
          notes: item.notes,
          netProfit: toDollars(profitCents),
          profitMargin:
            profitCents != null && soldPrice != null && soldPrice > 0
              ? Math.round((profitCents / (soldPrice * 100)) * 10000) / 100
              : null,
          createdAt: item.createdAt.toISOString(),
        };
      }),
    }),
  );
});

router.post("/backup/restore", async (req, res): Promise<void> => {
  const parsed = RestoreBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goals, contributions, items } = parsed.data;
  const goalIds = new Set(goals.map((goal) => goal.sourceId));
  if (goalIds.size !== goals.length) {
    res.status(400).json({ error: "Backup contains duplicate goal identifiers" });
    return;
  }
  if (contributions.some((entry) => !goalIds.has(entry.sourceGoalId))) {
    res.status(400).json({ error: "A contribution refers to a goal missing from the backup" });
    return;
  }
  if (
    items.some(
      (item) =>
        item.status === "sold" &&
        (item.soldPrice == null || item.soldDate == null),
    )
  ) {
    res.status(400).json({ error: "Sold items must include their sale price and date" });
    return;
  }

  const userId = res.locals.userId as string;
  const idBySourceId = new Map<string, string>();
  await db.transaction(async (tx) => {
    await tx.delete(resaleItemsTable).where(eq(resaleItemsTable.userId, userId));
    await tx.delete(contributionsTable).where(eq(contributionsTable.userId, userId));
    await tx.delete(goalsTable).where(eq(goalsTable.userId, userId));

    for (const goal of goals) {
      const [created] = await tx
        .insert(goalsTable)
        .values({
          userId,
          name: goal.name.trim(),
          targetCents: Math.round(goal.targetAmount * 100),
          targetDate: goal.targetDate ?? null,
          color: goal.color ?? "#557b65",
        })
        .returning({ id: goalsTable.id });
      idBySourceId.set(goal.sourceId, created.id);
    }

    for (const contribution of contributions) {
      const goalId = idBySourceId.get(contribution.sourceGoalId);
      if (!goalId) throw new Error("Backup goal mapping is incomplete");
      await tx.insert(contributionsTable).values({
        userId,
        goalId,
        amountCents: Math.round(contribution.amount * 100),
        contributionDate: contribution.date,
        note: contribution.note ?? null,
      });
    }

    if (items.length) {
      await tx.insert(resaleItemsTable).values(
        items.map((item) => ({
          userId,
          name: item.name.trim(),
          category: item.category ?? null,
          brand: item.brand ?? null,
          size: item.size ?? null,
          status: item.status ?? "inventory",
          purchasePriceCents: Math.round(item.purchasePrice * 100),
          purchaseDate: item.purchaseDate,
          listingPriceCents:
            item.listingPrice == null ? null : Math.round(item.listingPrice * 100),
          soldPriceCents:
            item.soldPrice == null ? null : Math.round(item.soldPrice * 100),
          platform: item.platform ?? null,
          platformFeeCents:
            item.platformFee == null ? null : Math.round(item.platformFee * 100),
          paymentFeeCents:
            item.paymentFee == null ? null : Math.round(item.paymentFee * 100),
          shippingCostCents:
            item.shippingCost == null ? null : Math.round(item.shippingCost * 100),
          otherCostsCents:
            item.otherCosts == null ? null : Math.round(item.otherCosts * 100),
          soldDate: item.soldDate ?? null,
          notes: item.notes ?? null,
        })),
      );
    }
  });

  res.json(
    RestoreBackupResponse.parse({
      goalsImported: goals.length,
      contributionsImported: contributions.length,
      itemsImported: items.length,
    }),
  );
});

export default router;