# Chore Royale™ — Spin · Battle · Win 👑

**The family game show for chores.** Spin the **Chore Roulette** to win your chores,
**battle** a sibling in a **Splat Showdown** to dodge one, finish the work, and a parent
**referees** to release your ⭐ stars. Trade stars for real prizes Mum & Dad set.

**Live:** https://3shamrocksstudio.github.io/chore-wars/

> A single-file, dependency-free PWA by [3Shamrocks Studio](https://github.com/3ShamrocksStudio).
> Kid-first game-show energy, parent-first integrity. © 2026 3Shamrocks Studio.

> **Repo / URL note:** the app is branded **Chore Royale**; the GitHub Pages path stays
> `/chore-wars/` so the existing live URL keeps working. Renaming the repo/URL is a
> separate (optional) step.

## The core loop

```
Spin the Chore Roulette  →  win a chore (bounded daily quota, never unlimited)
        │
        ├─ ⚔️ Battle a sibling (Splat Showdown) to dodge it
        ├─ 💰 Buy it off with stars (capped, priced high — recycles to the pool)
        └─ 🧹 Just do it
        │
   Tap "Done" → a parent confirms ✓ → the GAME ENGINE releases ⭐ stars + a spin
        │
   Spend stars → power-ups, or claim real prizes a parent delivers
```

## What's playable right now

- **Chore Roulette** — a 12-tile weighted wheel (no blanks): chores + specials (2×,
  Jackpot, Escape, Trade, Steal, Mystery, Freeze, Summer). Daily free spin + a daily
  cap, plus a **per-day chore quota** so the wheel never buries a kid.
- **Splat Showdown (battles)** — challenge a sibling for a chore. **Pie 🥧 beats
  Spaghetti 🍝 beats Ketchup 🍅 beats Pie** — a hidden-choice triangle. Same-device
  **pass-and-play**: each player picks in secret behind a handoff screen, reveals
  together, **best of 3**. **No timer, nothing aimed or reflex-based** — an 8-year-old
  can beat an 18-year-old. The splat **size is engine-rolled** (random), so a faster
  phone or older kid gets no edge. Winner dodges the chore; the **loser inherits it**
  (it's never destroyed — they still earn its stars by doing it). Plus a **Splat or
  Stop** push-your-luck mode for little ones (ages 4–6).
- **Parent = referee** — the parent screen's only powers are **confirm a chore ✓/✗**
  and **deliver a prize**. **No human (kid or parent) can set points, alter a battle, or
  hand out stars** — the engine is the sole neutral authority. Stars sit *held* until a
  parent confirms (toggle off for quick/solo play in **Family → Referee confirmation**).
- **Economy** — earn stars only by finishing real chores (+ modest battle/spin bonuses).
  Spend them on **power-ups** (extra spin, streak shield, double-up) or **buy off** a
  chore (**capped once/day, priced 3× the chore** — and the chore recycles into the
  pool). Claim **real prizes** a parent delivers.
- **Gamification** — avatars + wallet, 🔥 streaks with earnable ❄️ shields, a shared
  🏆 **family meter**, a weekly **leaderboard**, and a live **Summer Splash** season event.
- **Onboarding** — a 4-step game-show intro (name the clan, add champions, confirm
  prizes, start). **Chore Royale Plus** store screen scaffolded (subscription tier +
  cosmetic packs) — **no payment is wired**, by design.

## Cross-device (two phones) — the one Dave-gated step

Same-device pass-and-play is **fully live now**. Real-time play across two phones is
built to drop onto a **free Supabase project** and is the only piece that needs a parent
setup step (no spend beyond Supabase's free tier):

1. Create a free project at supabase.com → copy the **Project URL** and **anon key**.
2. Add a `config.js` next to `index.html`:
   ```js
   window.CHORE_ROYALE_NET = { url: "https://YOURPROJECT.supabase.co", anonKey: "ey..." };
   ```
3. Online battles use a **room code** over Supabase Realtime **broadcast** with a
   **commit–reveal** scheme: each player commits a hash of `(pick + nonce)` before either
   reveals, so neither can change their throw after seeing the other's; the splat size is
   seeded from **both** nonces, so neither side controls the "server roll." A faster phone
   or connection gets no advantage. The CSP already allows `*.supabase.co`.

Until `config.js` exists, the app stays 100% self-contained and same-device play is on.

## Tech & safety

- **One standalone `index.html`** — no build step, no runtime JS libraries (Google Fonts
  only). localStorage persistence (`choreroyale_v1`) with **Start over**; seeded so it
  opens alive.
- Strict **Content-Security-Policy**; user text rendered via escaped/`textContent` paths
  — **no `innerHTML` of raw user data, no `eval`**.
- **PWA** — manifest + inline SVG icon; installable. Service worker is **network-first**
  for navigations and **purges stale/foreign caches** on activate (the shared `github.io`
  org origin needs this).
- Mobile-first (verified at 390×844), accessible: focus rings, ARIA on the referee
  ✓/✗ controls, icon+word+colour (never colour-only), reduced-motion honored.
- **No ads, ever** — kids-category appropriate. Plus is an optional family subscription;
  cosmetics never touch chores, stars, or fairness.

## Run locally

```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

## License

© 2026 3Shamrocks Studio. All rights reserved. **Chore Royale™** — a 3Shamrocks Studio app.
