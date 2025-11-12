CREATE SCHEMA IF NOT EXISTS "app_huajune";
--> statement-breakpoint
CREATE TYPE "app_huajune"."dictionary_type" AS ENUM('brand', 'region', 'education', 'other');--> statement-breakpoint
CREATE TABLE "app_huajune"."data_dictionary" (
	"id" serial PRIMARY KEY NOT NULL,
	"dictionary_type" "app_huajune"."dictionary_type" NOT NULL,
	"mapping_key" varchar(100) NOT NULL,
	"mapping_value" varchar(255) NOT NULL,
	"source_system" varchar(50),
	"metadata" jsonb,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(100),
	"updated_by" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "app_huajune"."dictionary_change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dictionary_id" integer NOT NULL,
	"operation" varchar(20) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"change_reason" text,
	"operated_by" varchar(100) NOT NULL,
	"operated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_huajune"."dictionary_type_definition" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_code" varchar(50) NOT NULL,
	"type_name" varchar(100) NOT NULL,
	"description" text,
	"configuration" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dictionary_type_definition_type_code_unique" UNIQUE("type_code")
);
--> statement-breakpoint
CREATE INDEX "idx_dictionary_type" ON "app_huajune"."data_dictionary" USING btree ("dictionary_type");--> statement-breakpoint
CREATE INDEX "idx_type_key" ON "app_huajune"."data_dictionary" USING btree ("dictionary_type","mapping_key");--> statement-breakpoint
CREATE INDEX "idx_is_active" ON "app_huajune"."data_dictionary" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_active_type_key" ON "app_huajune"."data_dictionary" USING btree ("dictionary_type","mapping_key") WHERE "app_huajune"."data_dictionary"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_change_dictionary" ON "app_huajune"."dictionary_change_log" USING btree ("dictionary_id");--> statement-breakpoint
CREATE INDEX "idx_change_operated_at" ON "app_huajune"."dictionary_change_log" USING btree ("operated_at");