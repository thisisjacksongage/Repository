import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateGoalBody,
  CreateGoalContributionBody,
  CreateGoalContributionParams,
  CreateGoalContributionResponse,
  CreateGoalResponse,
  DeleteContributionResponse,
  DeleteContributionParams,
  DeleteGoalParams,
  DeleteGoalResponse,
  GetGoalContributionsParams,
  GetGoalContributionsResponse,
  GetGoalsResponse,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateGoalResponse,
} from "@workspace/api-zod";
import {
  contributionsTable,
  db,
  goalsTable,
} from "@workspace/db";
import { toDollars } from "../lib/money";

const router: IRouter = Router();

async function savedAmount(goalId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ amountCents: contributionsTable.amountCents })
    .from(contributionsTable)
    .where(
      and(
        eq(contributionsTable.goalId, goalId),
        eq(contributionsTable.userId, userId),
      ),
    );
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}

async function serializeGoal(
  row: typeof goalsTable.$inferSelect,
  userId: string,
) {
  const savedCents = await savedAmount(row.id, userId);
  return {
    id: row.id,
    name: row.name,
    targetAmount: toDollars(row.targetCents),
    savedAmount: toDollars(savedCents),
    targetDate: row.targetDate,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/goals", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(desc(goalsTable.createdAt));
  const response = await Promise.all(rows.map((row) => serializeGoal(row, userId)));
  res.json(GetGoalsResponse.parse(response));
});

router.post("/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [row] = await db
    .insert(goalsTable)
    .values({
      userId,
      name: parsed.data.name.trim(),
      targetCents: Math.round(parsed.data.targetAmount * 100),
      targetDate: parsed.data.targetDate ?? null,
      color: parsed.data.color ?? "#557b65",
    })
    .returning();
  res.status(201).json(
    CreateGoalResponse.parse({
      id: row.id,
      name: row.name,
      targetAmount: row.targetCents / 100,
      savedAmount: 0,
      targetDate: row.targetDate,
      color: row.color,
      createdAt: row.createdAt.toISOString(),
    }),
  );
});

router.patch("/goals/:goalId", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: parsed.success ? "No changes supplied" : parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const data = parsed.data;
  const values: Partial<typeof goalsTable.$inferInsert> = {};
  if (data.name !== undefined) values.name = data.name.trim();
  if (data.targetAmount !== undefined) values.targetCents = Math.round(data.targetAmount * 100);
  if ("targetDate" in data) values.targetDate = data.targetDate ?? null;
  if (data.color !== undefined) values.color = data.color;

  const [row] = await db
    .update(goalsTable)
    .set(values)
    .where(and(eq(goalsTable.id, params.data.goalId), eq(goalsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(UpdateGoalResponse.parse({
    ...row,
    targetAmount: row.targetCents / 100,
    savedAmount: (await savedAmount(row.id, userId)) / 100,
    createdAt: row.createdAt.toISOString(),
  }));
});

router.delete("/goals/:goalId", async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [row] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.goalId), eq(goalsTable.userId, userId)))
    .returning({ id: goalsTable.id });
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.status(204).json(DeleteGoalResponse.parse(undefined));
});

router.get("/goals/:goalId/contributions", async (req, res): Promise<void> => {
  const params = GetGoalContributionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const [goal] = await db
    .select({ id: goalsTable.id })
    .from(goalsTable)
    .where(and(eq(goalsTable.id, params.data.goalId), eq(goalsTable.userId, userId)))
    .limit(1);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const rows = await db
    .select()
    .from(contributionsTable)
    .where(
      and(
        eq(contributionsTable.goalId, params.data.goalId),
        eq(contributionsTable.userId, userId),
      ),
    )
    .orderBy(desc(contributionsTable.contributionDate), desc(contributionsTable.createdAt));
  res.json(
    GetGoalContributionsResponse.parse(
      rows.map((row) => ({
        id: row.id,
        goalId: row.goalId,
        amount: row.amountCents / 100,
        date: row.contributionDate,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/goals/:goalId/contributions", async (req, res): Promise<void> => {
  const params = CreateGoalContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateGoalContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [goal] = await db
    .select({ id: goalsTable.id })
    .from(goalsTable)
    .where(and(eq(goalsTable.id, params.data.goalId), eq(goalsTable.userId, userId)))
    .limit(1);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const [row] = await db
    .insert(contributionsTable)
    .values({
      userId,
      goalId: goal.id,
      amountCents: Math.round(parsed.data.amount * 100),
      contributionDate: parsed.data.date,
      note: parsed.data.note ?? null,
    })
    .returning();
  res.status(201).json(
    CreateGoalContributionResponse.parse({
      id: row.id,
      goalId: row.goalId,
      amount: toDollars(row.amountCents),
      date: row.contributionDate,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    }),
  );
});

router.delete("/contributions/:contributionId", async (req, res): Promise<void> => {
  const params = DeleteContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [row] = await db
    .delete(contributionsTable)
    .where(
      and(
        eq(contributionsTable.id, params.data.contributionId),
        eq(contributionsTable.userId, userId),
      ),
    )
    .returning({ id: contributionsTable.id });
  if (!row) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }
  res.status(204).json(DeleteContributionResponse.parse(undefined));
});

export default router;