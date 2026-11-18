CREATE TABLE "cash_fees" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"contract" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"local_time" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fills" ADD COLUMN "local_time" text;--> statement-breakpoint
ALTER TABLE "cash_fees" ADD CONSTRAINT "cash_fees_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_fees_account_idx" ON "cash_fees" USING btree ("account_id");