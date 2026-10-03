CREATE TABLE "rera_registry" (
	"registration_no" text PRIMARY KEY NOT NULL,
	"application_no" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"promoter" text,
	"locality" text,
	"street" text,
	"village" text,
	"mandal" text,
	"district" text,
	"pin_code" text,
	"survey_numbers" text,
	"lat" double precision,
	"lng" double precision,
	"detail_url" text,
	"details" jsonb,
	"detail_hash" text,
	"detail_fetched_at" timestamp with time zone,
	"detail_error" text,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"project_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rera_registry" ADD CONSTRAINT "rera_registry_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rera_registry_slug_idx" ON "rera_registry" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "rera_registry_district_idx" ON "rera_registry" USING btree ("district");--> statement-breakpoint
CREATE INDEX "rera_registry_detail_idx" ON "rera_registry" USING btree ("detail_fetched_at");