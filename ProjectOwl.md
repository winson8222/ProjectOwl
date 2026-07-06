1. Scan to settle
Open app — lands on Home: balance summary + recent transactions + "New transaction" button.
Start a transaction — tap "New transaction" → choose "Scan receipt" or "Manual entry."
Capture receipt — camera opens via the browser; user photographs the receipt.
Processing — image uploads to the Render backend, which calls the vision LLM API; frontend shows a loading state.
Extraction returned — backend returns structured JSON (merchant, date, items, tax, total); frontend moves to Review.
Review and correct — user checks each extracted item/price, fixes OCR errors, adds missed items, deletes wrong ones.
Select participants — user picks which friends are involved in this transaction (from friend list or a group).
Assign items — tap-to-expand screen: tap each item, select who's sharing it via avatar toggles; totals update live; unassigned items are flagged.
Validation — "Confirm split" stays disabled until every item has at least one person assigned.
Set the payer — user confirms who actually paid the merchant (defaults to the transaction creator).
Confirm and save — transaction, items, and splits save to Supabase; every involved user's balance recalculates.
Transaction summary — user sees the final breakdown for this receipt.
Reflected for everyone — other participants see it in their own history/balance next time they open the app.
Settle up (anytime) — from Home, "Settle up" opens the personalized view by default ("who you pay / who pays you"), with a toggle to the full group's optimized plan.
Mark as paid — once a real-world payment happens (e.g. PayNow), user manually marks that entry settled; balances update.
View history — browse past transactions, filter by friend/date, tap in for the full itemized breakdown.
2. Manual entry — custom split by percentage or amount
Start a transaction — from Home, tap "New transaction" → choose "Manual entry" instead of "Scan receipt."
Enter basics — type a description (e.g. "Movie tickets"), the total amount, and the date.
Select participants — pick which friends are involved, same participant picker used in Flow 1.
Choose split method — toggle between "Even split" (default) and "Custom split."
Enter custom values — for each participant, type either a percentage or a dollar amount; the two fields are linked, so entering one auto-fills the other.
Live allocation check — a running "remaining to allocate" indicator shows how much of the total (or what percentage) is still unassigned.
Validation — "Save transaction" stays disabled until entered amounts sum to exactly the total (small rounding differences auto-adjust to the last participant, or the user is warned).
Set the payer — same as Flow 1: confirm who actually paid, default is the creator.
Confirm and save — transaction and splits save to Supabase; balances recalculate for everyone involved.
Rejoins the main flow — lands on the same Transaction summary screen as step 12 in Flow 1.
3. View transaction — group view
Open history — from Home or a dedicated History tab, user sees a list of past transactions (description, date, total, their own share, who paid).
Tap a transaction — opens the Transaction detail screen.
See the breakdown — full itemized list with avatars showing who was assigned to each item, same visual style as the assign screen, but read-only.
Per-person totals — the same running-totals footer pattern, now showing final, static amounts.
Payer and status — shows who paid and whether the debt is settled or still pending, and for whom.
Available actions — edit (if the user has permission, e.g. only the creator), delete, or jump straight to "Settle up" for this specific debt if unsettled.
Back to list — navigate back to History, or to Home.
3. Your page (dashboard)
Open your page — from Home, the "You" / "My balance" area (could just be the Home screen itself).
See your balance — one clear headline number: your overall net balance.
Owe / owed split — two supporting numbers underneath: total you owe, total owed to you.
Top debtor & top creditor — two highlighted rows: the friend you owe the most, and the friend who owes you the most.
Recent Activity — show the recent transaction involving this person
Jump to a transaction — tap either highlight to open that transaction 
4. Transaction page
Open transaction page — reached from a Home/You "Highlights" tap (deep-links pre-filtered to that person), or directly from the History nav tab. Titled "Transactions."
Default view — all transactions involving you, most recent first. By default the Payee filter is set to You, so the list is scoped to transactions you're part of.
Filter by payer — a single-select Payer dropdown narrows the list to transactions paid by one specific person. Options: Anyone (default, no constraint), then You first, then each friend.
Filter by payees — a multi-select Payees dropdown narrows the list to transactions involving all selected people. You is listed first and selected by default; add friends to require them too.
Combine filters — Payer + Payees apply together (e.g. "paid by Alex, and involving You + Ben"). Arriving from a Highlight sets Payer to Anyone and Payees to You + that person, so you immediately see your shared transactions with them. An empty-state message appears when nothing matches.
Tap a transaction — opens the full breakdown (Transaction Details): for scanned receipts, a read-only itemized list with avatars showing who was assigned to each item, same visual style as the assign screen.
Per-person totals — a "Splits" section lists each participant with their final, static share amount (the running-totals footer pattern, now fixed).
Payer and status — a "Paid by" pill shows who paid; a Settled badge appears when the debt is settled (otherwise it reads as pending).
Available actions — Mark as Settled.
Back to list — returns to the Transactions list with your Payer/Payee filters still applied.
