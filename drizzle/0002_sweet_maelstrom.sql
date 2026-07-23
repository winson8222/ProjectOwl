CREATE TABLE "group_invites" (
	"token" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"expires_at" text,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_group_invites_group" ON "group_invites" USING btree ("group_id");