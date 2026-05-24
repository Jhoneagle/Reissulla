CREATE TABLE "pinned_stops" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gtfs_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vehicle_mode" varchar(32),
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recent_stops" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gtfs_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vehicle_mode" varchar(32),
	"visit_count" integer DEFAULT 1 NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pinned_stops" ADD CONSTRAINT "pinned_stops_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recent_stops" ADD CONSTRAINT "recent_stops_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_stops_user_gtfs_idx" ON "pinned_stops" USING btree ("user_id","gtfs_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recent_stops_user_gtfs_idx" ON "recent_stops" USING btree ("user_id","gtfs_id");