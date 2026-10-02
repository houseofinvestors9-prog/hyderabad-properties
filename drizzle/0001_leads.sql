CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"project_id" text,
	"project_name" text,
	"preferences" jsonb,
	"message" text,
	"slot" text,
	"page_path" text,
	"utm" jsonb,
	"consent" boolean DEFAULT false NOT NULL,
	"forward_status" text DEFAULT 'logged' NOT NULL,
	"forward_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "leads_phone_idx" ON "leads" USING btree ("phone");