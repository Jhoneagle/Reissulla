ALTER TABLE "pinned_stops" ADD COLUMN "is_station" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recent_stops" ADD COLUMN "is_station" boolean DEFAULT false NOT NULL;