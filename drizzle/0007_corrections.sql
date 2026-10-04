CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_url" text,
	"from_role" text DEFAULT 'other' NOT NULL,
	"name" text,
	"organisation" text,
	"contact" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "corrections_status_idx" ON "corrections" USING btree ("status","created_at");