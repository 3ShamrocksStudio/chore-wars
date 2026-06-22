# Chore Wars™ — The Wheel of Fortune Pivot

**The M Clan, reimagined around one centerpiece: the Wheel.**
A design-first concept for Dave's approval. © 2026 3Shamrocks Studio. All rights reserved.

> **One-line:** *Do your quests → earn spins → spin the Wheel for real loot.* The
> Wheel is the heart of Chore Wars — the reason a kid opens the app every day.

---

## 1. The core insight

A spin-the-wheel is the single most addictive interaction in games — the *variable
reward*. But a pure-luck wheel is wrong for chores: it decouples effort from reward,
feels unfair between siblings, and trains kids to gamble, not to work.

**So the Wheel never replaces effort — it amplifies it.** You can't spin until you've
earned a spin by finishing real chores. Luck decides *which* good thing you get, never
*whether* you get one. That one rule resolves every trap the old build fell into
(effort↔reward link, fairness, anti-nag, anti-gambling — see the prior `AUDIT.md`).

---

## 2. Two wheels, two moments of the day

The app has **one centerpiece component — a wheel — used in two modes.** A kid spends
99% of their time on the Reward Wheel; the Quest Wheel is an optional, delightful way
to *start* the day.

### 🌅 Quest Wheel — "What's my mission today?" (morning, optional)
Instead of a parent nagging or a flat to-do list, the day's **up-for-grabs chores**
live on a wheel. A kid taps **Spin** and the Wheel hands them a quest (or a small
bundle). It turns assignment into a ritual the *kid* initiates.

- **Baseline chores stay fixed** (brush teeth, make bed) — routine needs predictability,
  not a gamble. The Quest Wheel only ever spins the *extra / shared / bonus* pool.
- **Fairness engine (not pure random):** the Wheel is weighted so siblings end the week
  within a balanced band of total effort. A kid who's behind gets slightly kinder odds
  (a gentle Mario-Kart "catch-up"), so nobody checks out. Parents never see "the app
  played favorites."
- Landing on a quest = it's now yours, worth ⭐ stars + (on completion) a **Spin Token**.

### 🎁 Reward Wheel — "I earned a spin!" (the daily hook)
This is the centerpiece screen and the retention engine. Every **completed, verified**
chore drops a **Spin Token 🎟️** in the kid's pocket. Tokens spin the Reward Wheel.

- **Segments are 100% parent-curated, real, and good** — screen-time, a treat, "pick
  dinner", a few coins/allowance, "stay up 15 min", a **Skip-a-Chore** token, and a
  **Jackpot** slice that fills a meter toward the kid's big saved-for prize.
- **No blanks, no "lose a turn."** The worst outcome is a small win or a "Spin Again."
  Anti-frustration by design — a 7-year-old should never feel punished for showing up.
- **The spin is the dopamine.** Tap → the Wheel accelerates, ticks past slices, the
  pointer flickers, slows… lands. Confetti / treasure-burst. *That* is why they come
  back tomorrow — and it's gated entirely behind real work they already did.

---

## 3. The daily loop

```
   ┌─────────────────────────────────────────────────────────────┐
   │  OPEN  →  "You have 2 quests + 1 Spin waiting"               │
   │    │                                                          │
   │    ├─▶ (optional) SPIN QUEST WHEEL → claim today's mission   │
   │    │                                                          │
   │    ├─▶ DO A CHORE → snap photo proof → submit                │
   │    │        └─▶ parent verifies → ⭐ stars + 🎟️ Spin Token   │
   │    │                                                          │
   │    └─▶ SPIN REWARD WHEEL → win real loot 🎉                  │
   │             └─▶ Jackpot slice → big-prize meter grows 🌟      │
   │                                                               │
   │  STREAK 🔥 ticks up → come back tomorrow to keep it alive    │
   └─────────────────────────────────────────────────────────────┘
```

One screen to live on (My Wheel). Tap to finish a chore. Spin when you've earned it.
Everything else is chrome.

---

## 4. The spin economy (how spins are earned & kept fair)

| Source | Earns | Why it's fair / not naggy |
|--------|-------|---------------------------|
| Finish a **verified** chore | **1 Spin Token 🎟️** | You only spin off *your own* completed work — no stealing, no luck-to-earn |
| **Streak milestone** (e.g. 5-day 🔥) | **1 Golden Spin** (better odds / jackpot-rich wheel) | Rewards *showing up*, the real retention behaviour |
| **Weekly fairness top-up** | small odds nudge for whoever's behind | Keeps every sibling in the game; parents control the band |
| Parent bonus ("great week!") | gift a Spin | Manual delight, parent-controlled |

**Fairness guarantees (the sibling-peace rules):**
1. Every kid's Reward Wheel has **identical odds** — differences in winnings come *only*
   from how many chores they did. Effort is the only variable.
2. The Quest Wheel is **load-balanced weekly**, with a visible parent "fairness meter"
   so balance is provable, not vibes.
3. **Jackpot is per-kid by default** (you save toward *your* prize) — with an optional
   **Family Jackpot** mode where the clan pools spins toward one shared reward (teaches
   teamwork). *← open question for Dave.*

**Anti-pure-luck, anti-naggy, in one sentence each:**
- *Not luck:* the wheel only ever decides which good thing — the good thing itself is
  guaranteed and was earned by real, verified work.
- *Not naggy:* the kid pulls themselves in to spin; the parent stops being the alarm
  clock. Notifications say "🎟️ You've got spins!" not "you forgot your chores."

---

## 5. Roles (kept from the AUDIT — clarity wins)

- **Kid (Jakob / Dean):** lives on **My Wheel**. Quests to do, Spins to take, streak to
  protect, big prize growing. That's the whole app for them.
- **Parent (Daddy):** a calm **manager** behind a "Who's here?" picker — *Verify* what
  kids submitted (approve → token drops), *stock the Wheel* (set the real reward slices &
  odds per kid), *set the big prize*, and glance at the **fairness meter**. Quick in, out.

---

## 6. Brand & visual world (inherits the 3S Design System)

- **Keep Chore Wars™ + The M Clan** (Jakob, Dean, Daddy) — heroic, warm, not grim-war.
  The "quest / loot / treasure" framing fits the Wheel naturally.
- **Layer-1 world (existing):** Baloo 2 + Nunito · royal blue `#4F7CFF` · energetic
  orange `#FF6B35` · treasure gold `#F59E0B` · shamrock green · round corners, bouncy
  motion. WCAG-AA, 44px targets, status = colour **+ icon + word**, `reduced-motion`
  disables the spin animation (shows result instantly).
- **Real logos used as-is** — the shield/broom/duster crest is the Wheel's hub and the
  header mark. **The 3Shamrocks studio logo is never fabricated** (real `3shamrocks_black.png`
  on a light footer).
- **Grok** generated the on-brand arena backdrop + treasure-loot celebration art.

---

## 7. Why this drives retention (without the old pitfalls)

| Old Chore Wars / Sprout problem | How the Wheel fixes it |
|---|---|
| Abstract XP/coins bought nothing | Every spin pays out a **real, parent-set reward** |
| No reason to return tomorrow | **Earned spins + streak 🔥** = a daily ritual the kid wants |
| Felt naggy / parent-driven | Kid **pulls themselves in** to spin; parent steps back |
| Unfair between siblings | **Identical odds + weekly load-balancing + fairness meter** |
| "Is it a game or a tool?" | **Kid = the Wheel game. Parent = a calm 3-tab manager.** Cleanly split. |

---

## 8. Decisions locked (Dave's greenlight — 2026-06-22)

1. **Scope — Reward Wheel only (lean MVP).** First build = the *earn spins → Reward
   Wheel → win real loot* loop + the parent's verify/stock-the-wheel manager. The
   **Quest Wheel is deferred** to a later pass (concept kept on file in §2).
2. **Jackpot — both modes.** Parent chooses **per-kid** *or* **family-pooled** jackpot
   when setting up a kid's big prize.
3. **Chores — baseline fixed + wheel for extras.** Routine chores are assigned normally
   and predictably; the wheel layer sits on top. (Moot for the MVP since the Quest Wheel
   ships later — but it sets the model: the wheel never gambles the daily routine.)

**MVP build surface:** Who's-here picker · Kid = *My Wheel* (quests to finish → spin
tokens → Reward Wheel → win reveal → jackpot meter + streak) · Parent = Verify · Stock
the Wheel (slices + odds, per-kid) · Kids/prizes (per-kid vs family jackpot toggle).
Same single-file vanilla-JS + localStorage standard as the current app; 3S Design System
Layer-1 (Chore Wars world); WCAG-AA; `reduced-motion` shows results without the spin.

---

*Design gate passed. Ready to build the MVP on Dave's "go." © 2026 3Shamrocks Studio. All rights reserved.*
