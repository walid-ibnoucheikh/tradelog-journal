ALTER TABLE "accounts" ALTER COLUMN "drawdown_type" SET DATA TYPE text;--> statement-breakpoint
-- The static drawdown type is gone: such accounts are moved to EOD, the closest rule.
UPDATE "accounts" SET "drawdown_type" = 'eod_trailing' WHERE "drawdown_type" = 'static';--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "drawdown_type" SET DEFAULT 'eod_trailing'::text;--> statement-breakpoint
DROP TYPE "public"."drawdown_type";--> statement-breakpoint
CREATE TYPE "public"."drawdown_type" AS ENUM('eod_trailing', 'intraday_trailing');--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "drawdown_type" SET DEFAULT 'eod_trailing'::"public"."drawdown_type";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "drawdown_type" SET DATA TYPE "public"."drawdown_type" USING "drawdown_type"::"public"."drawdown_type";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "consistency_percent" numeric(14, 2);