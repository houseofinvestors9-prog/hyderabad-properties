CREATE TABLE "project_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_name" text NOT NULL,
	"name_key" text NOT NULL,
	"developer" text,
	"area" text,
	"rera_number" text,
	"stage" text,
	"searched_query" text,
	"requester_name" text,
	"requester_email" text,
	"requester_phone" text,
	"lead_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"added_project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "project_requests_name_idx" ON "project_requests" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "project_requests_status_idx" ON "project_requests" USING btree ("status","created_at");