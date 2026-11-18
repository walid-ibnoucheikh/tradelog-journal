CREATE TYPE "public"."account_type" AS ENUM('eval', 'funded');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('Long', 'Short');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('Buy', 'Sell');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"firm" text NOT NULL,
	"type" "account_type" DEFAULT 'eval' NOT NULL,
	"tradovate_name" text NOT NULL,
	"initial_balance" numeric(14, 2) NOT NULL,
	"profit_target" numeric(14, 2),
	"max_drawdown" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_tradovate_name_unique" UNIQUE("tradovate_name")
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"order_id" text NOT NULL,
	"contract" text NOT NULL,
	"product" text NOT NULL,
	"side" "side" NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(14, 4) NOT NULL,
	"commission" numeric(14, 2) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"trade_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"contract" text NOT NULL,
	"product" text NOT NULL,
	"direction" "direction" NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"quantity" integer NOT NULL,
	"avg_entry" numeric(14, 4) NOT NULL,
	"avg_exit" numeric(14, 4) NOT NULL,
	"gross_pnl" numeric(14, 2) NOT NULL,
	"commission" numeric(14, 2) NOT NULL,
	"net_pnl" numeric(14, 2) NOT NULL,
	"fill_ids" text[] NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fills_account_timestamp_idx" ON "fills" USING btree ("account_id","timestamp");--> statement-breakpoint
CREATE INDEX "trades_account_closed_idx" ON "trades" USING btree ("account_id","closed_at");