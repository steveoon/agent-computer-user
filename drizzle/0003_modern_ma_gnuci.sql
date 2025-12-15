ALTER TABLE "app_huajune"."recruitment_daily_stats" RENAME COLUMN "candidates_contacted" TO "inbound_candidates";--> statement-breakpoint
ALTER TABLE "app_huajune"."recruitment_daily_stats" ADD COLUMN "proactive_outreach" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_huajune"."recruitment_daily_stats" ADD COLUMN "proactive_responded" integer DEFAULT 0 NOT NULL;