CREATE TYPE "public"."account_status" AS ENUM('active', 'blown', 'closed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('evaluation', 'reset', 'activation', 'subscription', 'other_fee', 'payout');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"firm" text NOT NULL,
	"account_id" uuid,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "funded_at" date;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "ended_at" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_day_idx" ON "transactions" USING btree ("day");