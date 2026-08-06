CREATE TABLE "transaction_payers" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_paid" double precision NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_payers" ADD CONSTRAINT "transaction_payers_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_payers" ADD CONSTRAINT "transaction_payers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_payers_transaction" ON "transaction_payers" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_payers_user" ON "transaction_payers" USING btree ("user_id");--> statement-breakpoint
-- Backfill: every existing transaction becomes a single payer who put in the
-- whole amount, which is exactly what paid_by_user_id already meant. Balances
-- are unchanged by this migration — sum(amount_paid) - sum(share_amount)
-- reproduces the old "payer is owed everyone else's share" result.
INSERT INTO "transaction_payers" ("id", "transaction_id", "user_id", "amount_paid", "created_at")
SELECT 'tp-' || "id", "id", "paid_by_user_id", "total_amount", "created_at"
FROM "transactions";