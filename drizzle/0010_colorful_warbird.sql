CREATE TYPE "public"."sync_status" AS ENUM('pending', 'running', 'done', 'failed', 'needs_login');--> statement-breakpoint
CREATE TABLE "sync_agent" (
	"id" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sync_requests" ADD CONSTRAINT "sync_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;