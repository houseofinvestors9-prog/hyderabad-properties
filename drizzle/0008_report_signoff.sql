ALTER TABLE "projects" ADD COLUMN "questions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "signed_off_by" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "signed_off_at" timestamp with time zone;