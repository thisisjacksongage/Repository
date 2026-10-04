import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  CreateItemBody,
  CreateItemResponse,
  DeleteItemParams,
  DeleteItemResponse,
  GetItemsQueryParams,
  GetItemsResponse,
  UpdateItemBody,
  UpdateItemParams,
  UpdateItemResponse,
} from "@workspace/api-zod";
import { db, resaleItemsTable } from "@workspace/db";
import { resaleProfitCents, toDollars } from "../lib/money";

const router: IRouter = Router();

function serializeItem(row: typeof resaleItemsTable.$inferSelect) {
  const profitCents = resaleProfitCents(row);
  const soldPrice = toDollars(row.soldPriceCents);
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    size: row.size,
    status: row.status,
    purchasePrice: row.purchasePriceCents / 100,
    purchaseDate: row.purchaseDate,
    listingPrice: toDollars(row.listingPriceCents),
    soldPrice,
    platform: row.platform,
    platformFee: toDollars(row.platformFeeCents),
    paymentFee: toDollars(row.paymentFeeCents),
    shippingCost: toDollars(row.shippingCostCents),
    otherCosts: toDollars(row.otherCostsCents),
    soldDate: row.soldDate,
    notes: row.notes,
    netProfit: toDollars(profitCents),
    profitMargin:
      profitCents != null && soldPrice != null && soldPrice > 0
        ? Math.round((profitCents / (soldPrice * 100)) * 10000) / 100
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function dollarsToCents(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 100);
}

function saleFieldsInvalid(data: {
  status?: string;
  soldPrice?: number | null;
  soldDate?: string | null;
}): string | null {
  if (data.status === "sold" && data.soldPrice == null) {
    return "Enter the sale price before marking an item sold";
  }
  if (data.status === "sold" && !data.soldDate) {
    return "Enter the sale date before marking an item sold";
  }
  return null;
}

router.get("/items", async (req, res): Promise<void> => {
  const params = GetItemsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(resaleItemsTable)
    .where(eq(resaleItemsTable.userId, userId))
    .orderBy(resaleItemsTable.purchaseDate);
  const { status, platform, search } = params.data;
  const needle = search?.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    if (status && status !== "all" && row.status !== status) return false;
    if (platform && row.platform !== platform) return false;
    if (
      needle &&
      ![row.name, row.category ?? "", row.brand ?? ""]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle)
    ) {
      return false;
    }
    return true;
  });
  res.json(GetItemsResponse.parse(filtered.map(serializeItem)));
});

router.post("/items", async (req, res): Promise<void> => {
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const error = saleFieldsInvalid(parsed.data);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const data = parsed.data;
  const userId = res.locals.userId as string;
  const [row] = await db
    .insert(resaleItemsTable)
    .values({
      userId,
      name: data.name.trim(),
      category: data.category ?? null,
      brand: data.brand ?? null,
      size: data.size ?? null,
      status: data.status ?? "inventory",
      purchasePriceCents: Math.round(data.purchasePrice * 100),
      purchaseDate: data.purchaseDate,
      listingPriceCents: dollarsToCents(data.listingPrice),
      soldPriceCents: dollarsToCents(data.soldPrice),
      platform: data.platform ?? null,
      platformFeeCents: dollarsToCents(data.platformFee),
      paymentFeeCents: dollarsToCents(data.paymentFee),
      shippingCostCents: dollarsToCents(data.shippingCost),
      otherCostsCents: dollarsToCents(data.otherCosts),
      soldDate: data.soldDate ?? null,
      notes: data.notes ?? null,
    })
    .returning();
  res.status(201).json(CreateItemResponse.parse(serializeItem(row)));
});

router.patch("/items/:itemId", async (req, res): Promise<void> => {
  const params = UpdateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateItemBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: parsed.success ? "No changes supplied" : parsed.error.message });
    return;
  }
  const error = saleFieldsInvalid(parsed.data);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  const data = parsed.data;
  const values: Partial<typeof resaleItemsTable.$inferInsert> = {};
  if (data.name !== undefined) values.name = data.name.trim();
  if ("category" in data) values.category = data.category ?? null;
  if ("brand" in data) values.brand = data.brand ?? null;
  if ("size" in data) values.size = data.size ?? null;
  if (data.status !== undefined) values.status = data.status;
  if (data.purchasePrice !== undefined) values.purchasePriceCents = Math.round(data.purchasePrice * 100);
  if (data.purchaseDate !== undefined) values.purchaseDate = data.purchaseDate;
  if ("listingPrice" in data) values.listingPriceCents = dollarsToCents(data.listingPrice);
  if ("soldPrice" in data) values.soldPriceCents = dollarsToCents(data.soldPrice);
  if ("platform" in data) values.platform = data.platform ?? null;
  if ("platformFee" in data) values.platformFeeCents = dollarsToCents(data.platformFee);
  if ("paymentFee" in data) values.paymentFeeCents = dollarsToCents(data.paymentFee);
  if ("shippingCost" in data) values.shippingCostCents = dollarsToCents(data.shippingCost);
  if ("otherCosts" in data) values.otherCostsCents = dollarsToCents(data.otherCosts);
  if ("soldDate" in data) values.soldDate = data.soldDate ?? null;
  if ("notes" in data) values.notes = data.notes ?? null;

  const userId = res.locals.userId as string;
  const [row] = await db
    .update(resaleItemsTable)
    .set(values)
    .where(and(eq(resaleItemsTable.id, params.data.itemId), eq(resaleItemsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(UpdateItemResponse.parse(serializeItem(row)));
});

router.delete("/items/:itemId", async (req, res): Promise<void> => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  const [row] = await db
    .delete(resaleItemsTable)
    .where(and(eq(resaleItemsTable.id, params.data.itemId), eq(resaleItemsTable.userId, userId)))
    .returning({ id: resaleItemsTable.id });
  if (!row) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.status(204).json(DeleteItemResponse.parse(undefined));
});

export default router;