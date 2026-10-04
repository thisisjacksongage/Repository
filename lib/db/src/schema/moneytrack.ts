import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const goalsTable = pgTable(
  "moneytrack_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    targetCents: integer("target_cents").notNull(),
    targetDate: date("target_date", { mode: "string" }),
    color: text("color").notNull().default("#557b65"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("moneytrack_goals_user_idx").on(table.userId)],
);

export const contributionsTable = pgTable(
  "moneytrack_contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goalsTable.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    contributionDate: date("contribution_date", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moneytrack_contributions_user_idx").on(table.userId),
    index("moneytrack_contributions_goal_idx").on(table.goalId),
  ],
);

export const resaleItemsTable = pgTable(
  "moneytrack_resale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    brand: text("brand"),
    size: text("size"),
    status: text("status").notNull().default("inventory"),
    purchasePriceCents: integer("purchase_price_cents").notNull(),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    listingPriceCents: integer("listing_price_cents"),
    soldPriceCents: integer("sold_price_cents"),
    platform: text("platform"),
    platformFeeCents: integer("platform_fee_cents"),
    paymentFeeCents: integer("payment_fee_cents"),
    shippingCostCents: integer("shipping_cost_cents"),
    otherCostsCents: integer("other_costs_cents"),
    soldDate: date("sold_date", { mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moneytrack_resale_items_user_idx").on(table.userId),
    index("moneytrack_resale_items_status_idx").on(table.userId, table.status),
    index("moneytrack_resale_items_sold_date_idx").on(table.userId, table.soldDate),
  ],
);