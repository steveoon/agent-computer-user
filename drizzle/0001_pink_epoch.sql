CREATE TYPE "app_huajune"."recruitment_event_type" AS ENUM('candidate_contacted', 'message_sent', 'message_received', 'wechat_exchanged', 'interview_booked', 'candidate_hired');--> statement-breakpoint
ALTER TYPE "app_huajune"."dictionary_type" ADD VALUE 'position' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "app_huajune"."recruitment_agents" (
	"agent_id" varchar(50) PRIMARY KEY NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"platform" varchar(50) DEFAULT 'zhipin' NOT NULL,
	"primary_brand_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"configuration" jsonb,
	"last_active_at" timestamp with time zone,
	"last_sync_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_huajune"."recruitment_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(50) NOT NULL,
	"stat_date" timestamp with time zone NOT NULL,
	"brand_id" integer,
	"job_id" integer,
	"total_events" integer DEFAULT 0 NOT NULL,
	"unique_candidates" integer DEFAULT 0 NOT NULL,
	"unique_sessions" integer DEFAULT 0 NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"messages_received" integer DEFAULT 0 NOT NULL,
	"candidates_contacted" integer DEFAULT 0 NOT NULL,
	"candidates_replied" integer DEFAULT 0 NOT NULL,
	"unread_replied" integer DEFAULT 0 NOT NULL,
	"wechat_exchanged" integer DEFAULT 0 NOT NULL,
	"interviews_booked" integer DEFAULT 0 NOT NULL,
	"candidates_hired" integer DEFAULT 0 NOT NULL,
	"reply_rate" integer,
	"wechat_rate" integer,
	"interview_rate" integer,
	"is_dirty" boolean DEFAULT false NOT NULL,
	"aggregated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_huajune"."recruitment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(50) NOT NULL,
	"candidate_key" varchar(255) NOT NULL,
	"session_id" varchar(100),
	"event_type" "app_huajune"."recruitment_event_type" NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"candidate_name" varchar(100),
	"candidate_position" varchar(100),
	"candidate_age" varchar(20),
	"candidate_gender" varchar(10),
	"candidate_education" varchar(50),
	"candidate_expected_salary" varchar(50),
	"candidate_expected_location" varchar(100),
	"candidate_height" varchar(20),
	"candidate_weight" varchar(20),
	"candidate_health_cert" boolean,
	"event_details" jsonb,
	"source_platform" varchar(50) DEFAULT 'zhipin',
	"job_id" integer,
	"job_name" varchar(100),
	"brand_id" integer,
	"was_unread_before_reply" boolean,
	"unread_count_before_reply" integer DEFAULT 0,
	"message_sequence" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_source" varchar(20) DEFAULT 'tool_auto'
);
--> statement-breakpoint
CREATE UNIQUE INDEX "unique_daily_stats" ON "app_huajune"."recruitment_daily_stats" USING btree ("agent_id","stat_date","brand_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_rds_agent" ON "app_huajune"."recruitment_daily_stats" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_rds_date" ON "app_huajune"."recruitment_daily_stats" USING btree ("stat_date");--> statement-breakpoint
CREATE INDEX "idx_rds_agent_date" ON "app_huajune"."recruitment_daily_stats" USING btree ("agent_id","stat_date");--> statement-breakpoint
CREATE INDEX "idx_rds_dirty" ON "app_huajune"."recruitment_daily_stats" USING btree ("is_dirty");--> statement-breakpoint
CREATE INDEX "idx_re_agent" ON "app_huajune"."recruitment_events" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_re_time" ON "app_huajune"."recruitment_events" USING btree ("event_time");--> statement-breakpoint
CREATE INDEX "idx_re_type" ON "app_huajune"."recruitment_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_re_candidate" ON "app_huajune"."recruitment_events" USING btree ("candidate_key");--> statement-breakpoint
CREATE INDEX "idx_re_session" ON "app_huajune"."recruitment_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_re_agent_type_time" ON "app_huajune"."recruitment_events" USING btree ("agent_id","event_type","event_time");