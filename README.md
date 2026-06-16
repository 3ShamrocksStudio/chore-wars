# Chore Wars™ — Family Chores Made Simple ✅

A clean, friendly **family chore manager** with a light game layer that rewards
**real chore-doing and nothing else**. Add chores, assign them, complete & verify,
and the whole family works toward a shared reward (e.g. **Pizza Night**).

**Live:** https://3shamrocksstudio.github.io/chore-wars/

> A single-file, dependency-free PWA by [3Shamrocks Studio](https://github.com/3ShamrocksStudio).
> Function first, game layer second. See [`AUDIT.md`](AUDIT.md) for the full rebuild rationale.

## What it does

**A real chore manager:**

- **Add / edit / delete chores** — name, icon, **assignee**, **room/category**,
  **recurrence** (One-off · Daily · Weekly · Specific days) with a weekday picker,
  **due date** for one-offs, and XP/coin rewards.
- **Filterable, sortable views** in the **Chores** tab — **Today**, **This week**
  (grouped by day), **By person**, **By room**, **All**.
- **Today** tab — each member sees their own chores for today, one tap to mark done.
- **Follow-up** tab — **Awaiting verification** + **Overdue & missed**, with a live
  badge count so nothing slips.
- **Editable family members** — add / rename / remove, set role (kid or parent),
  color and emoji avatar.
- **Distinct status colors** — slate *To-do*, amber *Awaiting verify*, green *Done*,
  red *Overdue* — each also labelled with text + icon (never color-only).

**The completion flow:**

> Kid taps ✓ → **Awaiting verify** → parent approves → **Done** (XP + coins apply only now).
> Parents' own chores self-complete. A kid can tap an amber chore to undo.

**The game layer (tied to real chores):**

- **Family Goal** — *everyone finishes their chores this week → unlock the reward.*
  The progress bar is driven by **actual verified completions**, shows each member's
  contribution, and celebrates when the family hits the target. Reward name, icon, and
  target (Auto = all chores this week, or a custom number) are editable.
- **XP, levels, coins, weekly leaderboard, allowance** (10 🪙 = $1, parent pays out) —
  all earned **only** by completing real, verified chores.

## Tech & security

- **One standalone `index.html`** — no build step, no external JS libraries (Google Fonts only).
- **localStorage** persistence (`chorewars_v2`), with **Reset to demo data**; seeded so it opens alive.
- Dynamic/user text rendered via `textContent` / DOM builders — **no `innerHTML` of user data, no `eval`**.
- Ships a strict **Content-Security-Policy** meta tag.
- **PWA** — manifest + inline SVG icon; installable. Service worker is **network-first** for
  navigations, **unregisters stray sibling workers**, and **purges foreign caches** on activate
  (the shared `github.io` org origin needs this).
- Responsive, mobile-first, accessible: focus rings, skip link, aria labels, reduced-motion support.
- **Brand rule:** the 3Shamrocks logo always sits on a **dark-grey panel** wherever it appears.

## Run locally

```bash
# any static server works, e.g.
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

Camera-based photo proof needs a real device/browser and permission; it degrades
gracefully (a demo proof placeholder) when no camera/file is available.

## License

© 2026 3Shamrocks Studio. All rights reserved. **Chore Wars™** — a 3Shamrocks Studio app.
