import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { GetDashboardResponse } from "@workspace/api-zod";
import {
  contributionsTable,
  db,
  goalsTable,
  resaleItemsTable,
} from "@workspace/db";
import { resaleProfitCents } from "../lib/money";

const router: IRouter = Router();

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function activityDate(date: string | Date): string {
  return date instanceof Date
    ? date.toISOString()
    : new Date(`${date.slice(0, 10)}T12:00:00.000Z`).toISOString();
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [goals, contributions, items] = await Promise.all([
    db.select().from(goalsTable).where(eq(goalsTable.userId, userId)),
    db
      .select()
      .from(contributionsTable)
      .where(eq(contributionsTable.userId, userId))
      .orderBy(desc(contributionsTable.createdAt)),
    db
      .select()
      .from(resaleItemsTable)
      .where(eq(resaleItemsTable.userId, userId))
      .orderBy(desc(resaleItemsTable.createdAt)),
  ]);

  const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]));
  const totalSavedCents = contributions.reduce((total, row) => total + row.amountCents, 0);
  const savingsTargetCents = goals.reduce((total, row) => total + row.targetCents, 0);
  const soldItems = items.filter(
    (item) => item.status === "sold" && item.soldPriceCents != null && item.soldDate,
  );
  const totalProfitCents = soldItems.reduce(
    (total, item) => total + (resaleProfitCents(item) ?? 0),
    0,
  );
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyProfitCents = soldItems
    .filter((item) => monthKey(item.soldDate!) === currentMonth)
    .reduce((total, item) => total + (resaleProfitCents(item) ?? 0), 0);

  const now = new Date();
  const months = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (7 - index), 1));
    return {
      month: date.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
      sales: 0,
      profit: 0,
    };
  });
  const monthMap = new Map(months.map((month) => [month.month, month]));
  for (const item of soldItems) {
    const month = monthMap.get(monthKey(item.soldDate!));
    if (!month) continue;
    month.sales += (item.soldPriceCents ?? 0) / 100;
    month.profit += (resaleProfitCents(item) ?? 0) / 100;
  }

  const activity = [
    ...goals.map((goal) => ({
      id: `goal-${goal.id}`,
      type: "goal" as const,
      title: "Started a savings goal",
      subtitle: goal.name,
      amount: 0,
      date: activityDate(goal.createdAt),
    })),
    ...contributions.map((entry) => ({
      id: `contribution-${entry.id}`,
      type: "contribution" as const,
      title: `Added to ${goalNames.get(entry.goalId) ?? "a savings goal"}`,
      subtitle: entry.note ?? "Savings contribution",
      amount: entry.amountCents / 100,
      date: activityDate(entry.contributionDate),
    })),
    ...items.map((item) => ({
      id: `item-${item.id}`,
      type: "item" as const,
      title: `Added ${item.name} to inventory`,
      subtitle: "Purchase recorded",
      amount: -item.purchasePriceCents / 100,
      date: item.createdAt.toISOString(),
    })),
    ...soldItems.map((item) => ({
      id: `sale-${item.id}`,
      type: "sale" as const,
      title: `Sold ${item.name}`,
      subtitle: `Sale on ${item.platform ?? "marketplace"}`,
      amount: (resaleProfitCents(item) ?? 0) / 100,
      date: activityDate(item.soldDate!),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  res.json(
    GetDashboardResponse.parse({
      totalSaved: totalSavedCents / 100,
      savingsTarget: savingsTargetCents / 100,
      goalCount: goals.length,
      resaleProfit: totalProfitCents / 100,
      monthlyProfit: monthlyProfitCents / 100,
      activeListings: items.filter(
        (item) => item.status === "inventory" || item.status === "listed",
      ).length,
      itemsSold: soldItems.length,
      monthly: soldItems.length ? months : [],
      recentActivity: activity,
    }),
  );
});

export default router;