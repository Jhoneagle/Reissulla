CREATE TABLE "alert_seen" (
	"user_id" text NOT NULL,
	"alert_id" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_seen_user_id_alert_id_pk" PRIMARY KEY("user_id","alert_id")
);
--> statement-breakpoint
ALTER TABLE "alert_seen" ADD CONSTRAINT "alert_seen_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;