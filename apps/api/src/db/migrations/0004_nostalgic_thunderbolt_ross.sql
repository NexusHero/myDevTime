DROP INDEX "tags_workspace_name_uq";--> statement-breakpoint
DROP INDEX "time_entries_one_running_per_ws";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_name_uq" ON "tags" USING btree ("workspace_id","name") WHERE "tags"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running_per_ws" ON "time_entries" USING btree ("workspace_id") WHERE "time_entries"."ended_at" is null and "time_entries"."deleted_at" is null;--> statement-breakpoint
-- Sync versioning (REQ-006, ADR-0019): one monotonic sequence for the whole DB;
-- a trigger stamps every insert/update so `version` is a storage invariant,
-- independent of which code writes the row.
CREATE SEQUENCE IF NOT EXISTS "sync_version_seq" AS bigint;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bump_sync_version() RETURNS trigger AS $$
BEGIN
  NEW.version := nextval('sync_version_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
CREATE TRIGGER "clients_sync_version" BEFORE INSERT OR UPDATE ON "clients" FOR EACH ROW EXECUTE FUNCTION bump_sync_version();--> statement-breakpoint
UPDATE "clients" SET "version" = nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
CREATE TRIGGER "projects_sync_version" BEFORE INSERT OR UPDATE ON "projects" FOR EACH ROW EXECUTE FUNCTION bump_sync_version();--> statement-breakpoint
UPDATE "projects" SET "version" = nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
CREATE TRIGGER "tasks_sync_version" BEFORE INSERT OR UPDATE ON "tasks" FOR EACH ROW EXECUTE FUNCTION bump_sync_version();--> statement-breakpoint
UPDATE "tasks" SET "version" = nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
CREATE TRIGGER "tags_sync_version" BEFORE INSERT OR UPDATE ON "tags" FOR EACH ROW EXECUTE FUNCTION bump_sync_version();--> statement-breakpoint
UPDATE "tags" SET "version" = nextval('sync_version_seq');--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "version" SET DEFAULT nextval('sync_version_seq');--> statement-breakpoint
CREATE TRIGGER "time_entries_sync_version" BEFORE INSERT OR UPDATE ON "time_entries" FOR EACH ROW EXECUTE FUNCTION bump_sync_version();--> statement-breakpoint
UPDATE "time_entries" SET "version" = nextval('sync_version_seq');