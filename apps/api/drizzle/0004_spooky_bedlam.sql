CREATE TABLE "pinned_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gtfs_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"vehicle_mode" varchar(32) NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pinned_lines" ADD CONSTRAINT "pinned_lines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_lines_user_gtfs_idx" ON "pinned_lines" USING btree ("user_id","gtfs_id");