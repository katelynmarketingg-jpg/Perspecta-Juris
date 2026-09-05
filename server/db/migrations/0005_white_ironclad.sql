CREATE TABLE IF NOT EXISTS "job_locks" (
	"id" text PRIMARY KEY NOT NULL,
	"locked_until" text NOT NULL,
	"locked_by" text,
	"last_run_at" text,
	"last_result" jsonb
);
