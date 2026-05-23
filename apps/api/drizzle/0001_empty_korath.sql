CREATE TABLE "recent_places" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"display_name" text NOT NULL,
	"visit_count" integer DEFAULT 1 NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "distance_unit" varchar(20) DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "time_format" varchar(10) DEFAULT '24h' NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "high_contrast" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "font_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "sr_optimised" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_locations" ADD COLUMN "region" varchar(100);--> statement-breakpoint
ALTER TABLE "saved_locations" ADD COLUMN "category" varchar(32);--> statement-breakpoint
ALTER TABLE "recent_places" ADD CONSTRAINT "recent_places_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_locations_user_category_home_work_idx" ON "saved_locations" USING btree ("user_id","category") WHERE "saved_locations"."category" IN ('home', 'work');