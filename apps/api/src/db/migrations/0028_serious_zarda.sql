ALTER TABLE "recurring_entries" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD COLUMN "attendees" jsonb;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD COLUMN "conference_url" text;--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD COLUMN "conference_provider" text;