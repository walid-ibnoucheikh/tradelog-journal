CREATE TYPE "public"."drawdown_type" AS ENUM('eod_trailing', 'static');--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "drawdown_type" "drawdown_type" DEFAULT 'eod_trailing' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "drawdown_lock_level" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "daily_loss_limit" numeric(14, 2);