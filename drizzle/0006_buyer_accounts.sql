CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"ip" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_projects" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "saved_projects" ADD CONSTRAINT "saved_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_codes_phone_idx" ON "login_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "login_codes_ip_idx" ON "login_codes" USING btree ("ip","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_projects_pk" ON "saved_projects" USING btree ("user_id","kind","ref");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone");