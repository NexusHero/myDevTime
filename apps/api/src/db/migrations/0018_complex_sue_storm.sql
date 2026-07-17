CREATE TABLE "recurring_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"anchor_date" date NOT NULL,
	"start_min" integer NOT NULL,
	"len_min" integer NOT NULL,
	"freq" text NOT NULL,
	"end_kind" text DEFAULT 'never' NOT NULL,
	"until_date" date,
	"count" integer,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;