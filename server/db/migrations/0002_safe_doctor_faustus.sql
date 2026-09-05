ALTER TABLE "financial_entries" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "fee_kind" text;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "forma_pagamento" text;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "payment_link" text;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "received_via" text;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "received_amount" real;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "percentage" real;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "estimativa" real;--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "created_via_process" boolean DEFAULT false NOT NULL;