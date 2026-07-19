CREATE TABLE "wellbeing_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"load_score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"connector" text NOT NULL,
	"external_key" text NOT NULL,
	"task_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imported_issues_ws_user_conn_key" UNIQUE("workspace_id","user_id","connector","external_key")
);
--> statement-breakpoint
ALTER TABLE "wellbeing_days" ADD CONSTRAINT "wellbeing_days_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wellbeing_days" ADD CONSTRAINT "wellbeing_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_issues" ADD CONSTRAINT "imported_issues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_issues" ADD CONSTRAINT "imported_issues_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wellbeing_days_ws_user_day" ON "wellbeing_days" USING btree ("workspace_id","user_id","day");