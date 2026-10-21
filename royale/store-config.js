/* ============================================================================
   Chore Royale — STORE CONFIG   (the one file Dave edits to go chargeable)
   ----------------------------------------------------------------------------
   Rail: a Merchant of Record (Lemon Squeezy assumed) — Israel-friendly, handles
   VAT/tax/fraud, pays out to Dave. The app never sees card data or credentials.

   DEFAULT below = null  →  the Store runs a working TEST checkout (no real charge),
   so the full flow is provable before any account exists.

   ── TO GO CHARGEABLE (≈10 min, no code) ────────────────────────────────────
   1. Create a free Lemon Squeezy account (lemonsqueezy.com) — supports Israel.
      Keep the store in TEST MODE for now (toggle in the dashboard).
   2. Create 3 products (one per coin pack), priced in ILS:
        Coin Pouch  120 coins  ₪9.90
        Coin Chest  450 coins  ₪29.90
        Coin Vault  1200 coins ₪59.90
      (Optional: a "Chore Royale Plus" subscription product, ₪19.90/mo.)
   3. For each product open "Share" → copy its checkout link
      (looks like  https://YOURSTORE.lemonsqueezy.com/buy/XXXXXXXX-....).
   4. Paste them below, set test:true, and redeploy this one file. Done —
      "Buy" now opens the real MoR checkout; test card 4242 4242 4242 4242 works.
   5. When ready for real money: in Lemon Squeezy connect your payout account +
      switch the store to LIVE, then set test:false here. (Dave does steps 1 & 5
      in his own account — the agent never enters credentials or connects payouts.)

   FULFILMENT NOTE: on checkout success the MoR redirects back with ?purchase=<pack>
   and the app credits coins. That client-side credit is fine for an MVP top-up; for
   tamper-proof fulfilment, add a Lemon Squeezy webhook → serverless credit later.
   ============================================================================ */

window.CHORE_ROYALE_STORE = null;

/*  — Example once Dave has pasted his links (delete the null above, use this): —
window.CHORE_ROYALE_STORE = {
  provider: "lemonsqueezy",
  test: true,                              // false once the store is LIVE + payout connected
  checkout: {
    pouch: "https://YOURSTORE.lemonsqueezy.com/buy/REPLACE-POUCH-ID",
    chest: "https://YOURSTORE.lemonsqueezy.com/buy/REPLACE-CHEST-ID",
    vault: "https://YOURSTORE.lemonsqueezy.com/buy/REPLACE-VAULT-ID"
  }
};
*/
