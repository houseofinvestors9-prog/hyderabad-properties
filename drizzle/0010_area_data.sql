CREATE TABLE "hmda_lakes" (
	"lake_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"district" text,
	"mandal" text,
	"village" text,
	"preliminary_notified" text,
	"final_notified" text,
	"ftl_pdf" text,
	"cadastral_pdf" text,
	"survey_pdf" text,
	"survey_numbers" jsonb,
	"survey_village" text,
	"survey_read_at" timestamp with time zone,
	"survey_error" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "igr_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"village_id" text NOT NULL,
	"ward_block" text,
	"locality" text NOT NULL,
	"land_per_sq_yd" integer,
	"apt_ground_per_sq_ft" integer,
	"apt_first_per_sq_ft" integer,
	"apt_other_per_sq_ft" integer,
	"classification" text,
	"effective_date" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "igr_villages" (
	"id" text PRIMARY KEY NOT NULL,
	"district_code" text NOT NULL,
	"district_name" text NOT NULL,
	"mandal_code" text NOT NULL,
	"mandal_name" text NOT NULL,
	"village_code" text NOT NULL,
	"village_name" text NOT NULL,
	"row_count" integer,
	"fetched_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "ingest_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_bodies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"kind" text,
	"area_sqm" double precision,
	"min_lat" double precision NOT NULL,
	"min_lng" double precision NOT NULL,
	"max_lat" double precision NOT NULL,
	"max_lng" double precision NOT NULL,
	"rings" jsonb NOT NULL,
	"tile" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rera_registry" ADD COLUMN "lake_screen" jsonb;--> statement-breakpoint
ALTER TABLE "rera_registry" ADD COLUMN "guideline" jsonb;--> statement-breakpoint
ALTER TABLE "igr_rates" ADD CONSTRAINT "igr_rates_village_id_igr_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."igr_villages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hmda_lakes_village_idx" ON "hmda_lakes" USING btree ("village");--> statement-breakpoint
CREATE INDEX "igr_rates_village_idx" ON "igr_rates" USING btree ("village_id");--> statement-breakpoint
CREATE INDEX "igr_villages_mandal_idx" ON "igr_villages" USING btree ("district_code","mandal_name");--> statement-breakpoint
CREATE INDEX "igr_villages_due_idx" ON "igr_villages" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "water_bodies_bbox_idx" ON "water_bodies" USING btree ("min_lat","max_lat","min_lng","max_lng");--> statement-breakpoint
CREATE INDEX "water_bodies_tile_idx" ON "water_bodies" USING btree ("tile");