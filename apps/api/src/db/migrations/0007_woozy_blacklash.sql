CREATE TABLE "entitlement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_events_ws_provider_uq" UNIQUE("workspace_id","provider_event_id")
);
--> statement-breakpoint
ALTER TABLE "entitlement_events" ADD CONSTRAINT "entitlement_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;