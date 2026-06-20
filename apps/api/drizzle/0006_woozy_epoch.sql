CREATE TABLE "trip_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_lat" double precision NOT NULL,
	"from_lon" double precision NOT NULL,
	"to_lat" double precision NOT NULL,
	"to_lon" double precision NOT NULL,
	"from_name" text,
	"to_name" text,
	"itinerary" jsonb NOT NULL,
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferences" ADD COLUMN "trip_log_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_log" ADD CONSTRAINT "trip_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_log_user_planned_idx" ON "trip_log" USING btree ("user_id","planned_at");