# Chore Royale Plus — proposal (not built)

> **Decided:** $19.99 / year per family (option A). Not built yet. The in-app "Plus — coming soon"
> pop-up lists the 4 pillars below, with no price shown.

## The constraint: one player per phone

Each family member plays on their **own phone**, all synced through one family record. So Plus
is bought **once per family, by a parent**, and unlocks on **every phone in that family**. A kid
never sees a paywall in the middle of a quest.

## What stays free, forever

The whole chore loop: Royal Wheel, the 8 built-in quests, Speed Runs, parent approval, photo
proof, streaks, Rest Day, Royal Pardon, the weekly villain, the family reward, ranks, the weekly
Crown and family sync on everyone's phone. **Plus never sells XP, stars or wins.** The game sets
every star.

## What Plus adds (4 pillars)

| Pillar | What families get | Why they'd pay | Build cost |
|---|---|---|---|
| **1. Custom Quests** | Parents write their own quests ("Feed the cat", "Practice piano"): emoji, XP tier, optional Speed Run timer, photo proof, which days, which knights. They go on the Royal Wheel next to (or instead of) the 8 built-in ones. | #1 thing a real family needs after week one: *their* chores | M: `CHORES` becomes built-in + `families/$fid/quests`; wheel draws N segments |
| **2. Seasonal Armor** | Cosmetic armor skins and medallion frames per knight: Frost Knight (winter), Pumpkin Knight (Halloween), Festival of Lights (Hanukkah), Summer Splash. Kids pick theirs on their own phone; everyone sees it on the Ranks podium. | Kids ask for it. Pure cosmetics, so nothing pay-to-win | S–M: token hue swaps + 4–6 extra knight renders (webp ≈ 30 KB each) |
| **3. Family Chronicle** | The castle's history book: every week's Crown, villains beaten, rewards won, longest streaks, Speed Run records, a "this month" card to share on WhatsApp. | Parents love the record. It's what makes them stay subscribed | M: weekly snapshot written at "Start Fresh Week" to `families/$fid/chronicle/$week` (≈ 1 KB/week) |
| **4. Villain Packs** | Monthly **Big Boss** (Balagan himself shows up for a 2-week family goal with a bigger reward) plus extra minions: the Crumb Kraken, Laundry Lich, Homework Hydra. | Fresh story every month keeps the game from going stale | S: data + art, same goal engine |

Optional add-on later: **Allowance Ledger** (convert XP to agreed pocket money, parent-only view).

## Pricing (pick one)

| Option | Price | Notes |
|---|---|---|
| A. Yearly family pass | **$19.99 / year** (≈ ₪69) | Recommended. One price, every phone in the family, new seasons included |
| B. Season pass | **$4.99 / season** (3 months) | Matches LickPick's price point. Easy first yes |
| C. Lifetime | **$39** | Only as a launch offer for the first 100 families |

## $0 infrastructure

- **Checkout:** Lemon Squeezy or Polar hosted checkout (merchant of record handles VAT; no
  monthly fee, percentage per sale). The same account Dave opens for LickPick.
- **Licence:** reuse LickPick's offline **ECDSA licence keys**. The buyer receives a key by email.
  The app checks the signature against a public key baked into `index.html`, so no server.
- **Unlock for the whole family:** a parent pastes the key once. It's stored at
  `families/$fid/plus = { key, until }`. A new rules entry allows writes **only by a linked parent
  with a valid shape**. Every phone in the family reads it and unlocks.
- **Same-phone families** (no sync) store it in `localStorage` like today's `cr_premium`.
- **Honest limit:** a client-side gate can be bypassed by a tech-savvy user. Fine for cosmetics
  and convenience features; it costs nothing and protects nothing critical.

## Where Plus shows up (gentle, parent-facing)

- Family → parent area: a "👑 Plus" plate under House rules (parents only, behind the PIN).
- Ranks podium: locked armor previews with "Plus" gems. Kids can *ask* a parent; they can't buy.
- Custom Quests: "＋ Add your own quest" row on the parent area, opens the Plus sheet.
- Never: during a Speed Run, on the reward screen, or in front of a kid's approval.

## Rollout

1. Dave opens the Lemon Squeezy/Polar account (already on the LickPick path) → 1 product, 1 key pair.
2. Build Custom Quests + the Plus gate (largest value, ~2–3 days).
3. Add Chronicle snapshots (~1 day), then the first armor skin and the first Big Boss as "Season 1".
4. Soft launch to the first families on WhatsApp. Measure week-2 retention, free → Plus.
