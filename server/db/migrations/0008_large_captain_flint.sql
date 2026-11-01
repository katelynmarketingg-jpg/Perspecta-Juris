CREATE TABLE IF NOT EXISTS "service_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"client_id" text,
	"client_name" text NOT NULL,
	"assigned_to_id" text,
	"assigned_to_name" text,
	"tipo" text DEFAULT 'presencial' NOT NULL,
	"obs" text,
	"status" text DEFAULT 'fila' NOT NULL,
	"created_at" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text,
	"attended_at" text,
	"attended_by_id" text,
	"attended_by_name" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_attended_by_id_users_id_fk" FOREIGN KEY ("attended_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_tenant_idx" ON "service_visits" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_client_idx" ON "service_visits" USING btree ("client_id");