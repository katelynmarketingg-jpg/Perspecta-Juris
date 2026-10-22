ALTER TABLE "financial_entries" ALTER COLUMN "due_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "folder" text;