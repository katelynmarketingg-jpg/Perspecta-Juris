CREATE TABLE IF NOT EXISTS "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"kind" text NOT NULL,
	"qty" real DEFAULT 1 NOT NULL,
	"meta" jsonb,
	"user_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_tenant_kind_idx" ON "usage_events" USING btree ("tenant_id","kind","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_created_idx" ON "usage_events" USING btree ("created_at");