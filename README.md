# Chore Wars™ — The M Clan ⚔️

A playful, fully-owned **warrior-family gamified chore game** for The M Clan —
**Jakob**, **Dean**, and **Daddy** (Clan Leader). Slay daily quests, raid
**Pizza Night** together, build **Clan Momentum**, and earn real allowance.
Celebratory battle energy, never naggy.

**Live:** https://3shamrocksstudio.github.io/chore-wars/

> A single-file, dependency-free PWA by [3Shamrocks Studio](https://github.com/3ShamrocksStudio).
> Palette: battle orange `#FF6B35`, victory teal `#4ECDC4`, power purple `#7B68EE` on warm cream.

## The Clan

- **Jakob** — pink/red armor warrior
- **Dean** — orange armor warrior
- **Daddy** — green armor **Clan Leader** (small crown), parent oversight

## Features

- **5 tabs** — Missions · Extras · Goals · Squad/Clan · Me
- **Daily quests** with one-tap "Slay the Quest", XP + coin rewards, satisfying XP-burst & victory toasts.
- **Photo proof** (+15 XP) — snap a picture; **Daddy verifies** it in the Clan Leader oversight panel.
- **Clan Momentum streak meter** — Cold → Warming → Steady → Hot → On Fire, with “X days to next level — clan needs you!”
- **Pizza Night raid** — a shared campaign boss with a health bar; every quest the clan completes deals damage. Defeat it together to unlock the celebration.
- **Battle Log** — a live feed of clan victories.
- **Allowance treasury** — coins convert to allowance (10 🪙 = $1); kids request a payout, **Daddy approves**.
- **Bonus quests (Extras)** — optional epic quests for bigger loot; claim → complete → approve.
- **Armory** — unlock & equip new armor (Frost Plate, Golden Aegis, Shadow Mail, Champion's Crown) with coins/XP.
- **Parent (Daddy) oversight view** — verify photo proof, approve bonus quests, approve allowance.
- **Encouraging empty states** — “Ready for battle?”, “All quests slayed!”
- **Multi-profile** (Jakob / Dean / Daddy) with full **localStorage** persistence + **Reset Demo Data**.
- Seeded with believable demo data so it opens alive.

## Tech & security

- **One standalone `index.html`** — no build step, no external JS libraries (Google Fonts only).
- Cartoon warrior **avatars are consistent inline SVG** (a parametric family set); app icon is inline SVG.
- Dynamic/user text rendered via `textContent` / DOM builders — **no `innerHTML` of user data, no `eval`**.
- Ships a **Content-Security-Policy** meta tag and is CSP-friendly.
- **PWA** — manifest + inline SVG icon; installable to the home screen.
- **Service worker** is **network-first** for navigations, **unregisters stray sibling workers**, and
  **purges foreign caches** on activate (lesson from the shared `github.io` org origin).
- Responsive, kid-friendly, **WCAG AA** (focus rings, skip link, aria labels, reduced-motion support).

## Run locally

```bash
# any static server works, e.g.
python3 -m http.server 8080
# then open http://localhost:8080/index.html
```

Camera-based photo proof needs a real device/browser and permission; it degrades
gracefully (a demo proof placeholder) when no camera/file is available.

## License

© 2026 3Shamrocks Studio. All rights reserved. **Chore Wars™** — a 3Shamrocks Studio game.
