import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const accountType = pgEnum("account_type", ["eval", "funded"])
export const drawdownType = pgEnum("drawdown_type", ["eod_trailing", "intraday_trailing"])
export const accountStatus = pgEnum("account_status", ["active", "blown", "closed"])
export const transactionType = pgEnum("transaction_type", [
  "evaluation",
  "reset",
  "activation",
  "subscription",
  "other_fee",
  "payout",
  "education",
  "tools",
])
export const syncStatus = pgEnum("sync_status", [
  "pending",
  "running",
  "done",
  "failed",
  "needs_login",
])
export const side = pgEnum("side", ["Buy", "Sell"])
export const direction = pgEnum("direction", ["Long", "Short"])

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" })
const price = (name: string) => numeric(name, { precision: 14, scale: 4, mode: "number" })

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Prop firm, e.g. "Apex" or "Tradeify". */
  firm: text("firm").notNull(),
  type: accountType("type").notNull().default("eval"),
  /** Tradovate account name as it appears in the exports; used to match imported fills. */
  tradovateName: text("tradovate_name").notNull().unique(),
  initialBalance: money("initial_balance").notNull(),
  profitTarget: money("profit_target"),
  maxDrawdown: money("max_drawdown"),
  /** How the drawdown threshold trails: the end-of-day balance peak, or the intraday balance peak. */
  drawdownType: drawdownType("drawdown_type").notNull().default("eod_trailing"),
  /** Balance above which the drawdown threshold stops rising; null when it never stops. */
  drawdownLockLevel: money("drawdown_lock_level"),
  /** Largest loss allowed in one trading day; null when the account has no such rule. */
  dailyLossLimit: money("daily_loss_limit"),
  /** Consistency rule: the best day may not exceed this share (%) of the total profit; null for no rule. */
  consistencyPercent: money("consistency_percent"),
  status: accountStatus("status").notNull().default("active"),
  /** Day the evaluation was passed and the account became funded. */
  fundedAt: date("funded_at"),
  /** Day the account was blown or closed; null while active. */
  endedAt: date("ended_at"),
  /** When a Tradovate file was last imported for this account; null until the first import. */
  lastImportedAt: timestamp("last_imported_at", { withTimezone: true }),
  /**
   * Which saved Tradovate login this account uses (`tradovate_logins.firm_key`); null = the login of
   * its prop firm. Two accounts of one firm may sit on two different Tradovate logins.
   */
  loginKey: text("login_key"),
  /** When the sync agent first did not find this account in its Tradovate login; null while it does. */
  notFoundAt: timestamp("not_found_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const fills = pgTable(
  "fills",
  {
    /** Tradovate fill ID, globally unique, so re-importing a file never duplicates. */
    id: text("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull(),
    contract: text("contract").notNull(),
    product: text("product").notNull(),
    side: side("side").notNull(),
    quantity: integer("quantity").notNull(),
    price: price("price").notNull(),
    commission: money("commission").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    /** Tradovate's local clock ("10/15/2026 15:03:49"), used to match Cash History fees. Null on fills imported before fees existed. */
    localTime: text("local_time"),
    tradeDate: date("trade_date").notNull(),
  },
  (table) => [index("fills_account_timestamp_idx").on(table.accountId, table.timestamp)]
)

/** Fees from Tradovate's Cash History (commission, exchange, clearing, NFA...), one row each. */
export const cashFees = pgTable(
  "cash_fees",
  {
    /** Tradovate transaction ID, so re-importing a file never duplicates. */
    id: text("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contract: text("contract").notNull(),
    type: text("type").notNull(),
    /** Positive = cost, negative = rebate. */
    amount: money("amount").notNull(),
    /** Tradovate's local clock, the same as `fills.local_time`. */
    localTime: text("local_time").notNull(),
  },
  (table) => [index("cash_fees_account_idx").on(table.accountId)]
)

/** Derived from fills; rebuilt for an account after each import. */
export const trades = pgTable(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    contract: text("contract").notNull(),
    product: text("product").notNull(),
    direction: direction("direction").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
    quantity: integer("quantity").notNull(),
    avgEntry: price("avg_entry").notNull(),
    avgExit: price("avg_exit").notNull(),
    grossPnl: money("gross_pnl").notNull(),
    commission: money("commission").notNull(),
    netPnl: money("net_pnl").notNull(),
    fillIds: text("fill_ids").array().notNull(),
    /** Journal note. Carried over on rebuild by matching the trade's first fill ID. */
    note: text("note"),
    /** Walid's call on break-even: true forces it, false rules it out, null follows the rule. Kept on rebuild like the note. */
    breakEvenOverride: boolean("break_even_override"),
  },
  (table) => [index("trades_account_closed_idx").on(table.accountId, table.closedAt)]
)

/** Free-text journal entry for a trading day, shared by every account. */
export const dayNotes = pgTable("day_notes", {
  /** Trading day, YYYY-MM-DD in New York time. */
  day: date("day").primaryKey(),
  note: text("note").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** A folder of the Notebook; the Daily Journal and Trade notes folders are not rows, they come from the other tables. */
export const noteFolders = pgTable("note_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** A free note of the Notebook (not tied to a day or a trade). `content` is Tiptap's JSON document. */
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  /** Deleting a folder keeps its notes, which go back to "My notes". */
  folderId: uuid("folder_id").references(() => noteFolders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** A picture pasted into a note, compressed by the browser and kept as base64 text. */
export const noteImages = pgTable("note_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Real money moving between Walid and the prop firms. Amounts are always positive: the type
 * says whether it is a cost or a payout received.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: date("day").notNull(),
    /** The prop firm, or the provider (TradingView, a mentor...) for education and tools spending. */
    firm: text("firm").notNull(),
    /** Kept when the account is deleted so the spending history survives. */
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    type: transactionType("type").notNull(),
    amount: money("amount").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("transactions_day_idx").on(table.day)]
)

/** A request to sync Tradovate data, picked up by the local sync agent (see `src/db/sync.ts`). */
export const syncRequests = pgTable("sync_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** The account to sync; null means every active account (of `firm` when that is set). */
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  /** Sync every active account of this prop firm (one Tradovate login); null when not by firm. */
  firm: text("firm"),
  status: syncStatus("status").notNull().default("pending"),
  /** What happened, in a sentence: a summary, an error, or which login to renew. */
  message: text("message"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
})

/**
 * A saved Tradovate login (one login serves all the accounts that point to it), encrypted with
 * `CREDENTIALS_KEY` (see `src/lib/credentials/crypto.ts`). The cloud sync run receives it with its request.
 */
export const tradovateLogins = pgTable("tradovate_logins", {
  /**
   * The login's key (`loginKey` in `src/lib/sync/firm-key.ts`): the prop firm in lower case for its
   * default login, "firm:name" for an additional one. The column keeps its first name.
   */
  firmKey: text("firm_key").primaryKey(),
  firm: text("firm").notNull(),
  /** The name of an additional login ("Apex 2"); null for the default login of the firm. */
  label: text("label"),
  /** `v1.iv.tag.ciphertext` of {username, password}. */
  secret: text("secret").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Unused since the local agent was removed (the cloud run is started on demand): kept until a migration drops it. */
export const syncAgent = pgTable("sync_agent", {
  id: text("id").primaryKey(),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  hotUntil: timestamp("hot_until", { withTimezone: true }),
})
