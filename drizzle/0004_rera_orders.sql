CREATE TABLE "rera_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"listing" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"order_date" text,
	"pdf_url" text NOT NULL,
	"case_no" text,
	"respondent" text,
	"respondent_key" text,
	"penalty_inr" integer,
	"registration_nos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentioned_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text" text,
	"fetched_at" timestamp with time zone,
	"error" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rera_orders_date_idx" ON "rera_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "rera_orders_respondent_idx" ON "rera_orders" USING btree ("respondent_key");