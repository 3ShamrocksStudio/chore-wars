# Chore Wars

A household chore game. Every family member plays on their own phone: grab chores, steal them, swap them, duel a sibling, and win the weekly crown. A parent referees: points only land after the parent approves, with a photo.

A 3Shamrocks Studio game. **Staging only. Not public.**

## Where things are

| Path | What it is |
|---|---|
| `app/` | The current Chore Wars PWA (rebuilt 4 Nov 2026). Staging: https://3shamrocksstudio.github.io/lab/chore-wars/ |
| `app/brand.html` | Brand sheet: logo, colours, type, icons, ranks, players, motion |
| `app/model.html` | One-page business model with sourced benchmarks |
| `app/brand/` | Logo SVG + PNG exports, app icons, icon sprite |
| `tools/` | Brand generator, PNG export, multi-phone QA (`qa_sync.py`) |
| `db/` | SQL for the Supabase `cw_*` functions changed on 4 Nov 2026 (no secrets) |
| root `index.html`, `landing.html`, `royale/`, `preview/`, `wheel-concept/` | Redirects to `app/`. The earlier prototypes are in git history only. |

## Core loop

- **Grab** an open chore (max 3 at once). Points shown on every tile.
- **Steal** a chore someone else holds with a Steal card. A **Shield** card blocks one steal.
- **Swap**: offer your chore for theirs, optionally adding points. They can accept, decline or **counter**.
- **Bounty**: the parent adds +10 (up to +30) to the chore nobody wants.
- **Duel**: challenge a player; whoever earns more points this week wins +25 XP.
- **Done**: snap a proof photo, the parent approves, points and XP land, streak grows. The photo is deleted from the server on approval.
- **Leaderboard** resets weekly (Israel time); last week's leader wears the crown.
- **Ranks** by lifetime XP: Rookie 0, Brawler 100, Hero 300, Legend 700.

## Backend

Supabase (existing free project, tables prefixed `cw_`). Row-level security is on with no table policies, so the publishable key cannot read or write tables directly. Every read and move goes through `cw_*` Postgres functions that check the device's secret and the player's household, and enforce every rule server-side. Devices sync through a Realtime broadcast ping per household, plus a 9-second poll as backup.

Join flow: the parent creates a family and gets a 6-letter code plus QR. A kid opens the link on their own phone, picks a name, avatar and badge, and asks to join. The phone waits and sees nothing of the family until a parent taps "Let in" (or matches it to a freed seat). The parent seat on a second phone needs the family code plus the parent PIN. Code checks, join requests and PIN tries are rate-limited per IP, device and family: 5 per 15 minutes, then locked. PINs are bcrypt (pgcrypto).

Data kept: first name or nickname, avatar, badge, game scores. No email, phone, location or account. Proof photos are small (max 720 px JPEG), deleted on approval, and deleted after 7 days if never reviewed (hourly pg_cron job).

Demo: "Try the demo" runs an invented family (The Thunder House: Captain, Zap, Nova) inside the browser only. It never touches the server and resets on reload.

## Run locally

```bash
cd app && python3 -m http.server 8931
python3 tools/qa_sync.py http://localhost:8931/ /tmp/cw-qa   # 3 phones, sync + screenshots
```

© 2026 3Shamrocks Studio. All rights reserved.
