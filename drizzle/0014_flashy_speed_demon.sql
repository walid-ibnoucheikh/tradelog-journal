CREATE TABLE "tradovate_logins" (
	"firm_key" text PRIMARY KEY NOT NULL,
	"firm" text NOT NULL,
	"secret" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
