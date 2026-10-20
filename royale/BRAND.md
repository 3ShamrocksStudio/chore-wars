# Chore Royale™ — Brand World

The Chore Royale brand is a **3S Design System (3SDS) theme**, not a one-off look.
It is one Layer-1 block — `[data-brand="choreroyale"]` in the 3SDS
([`3Shamrocks-Studio/Design-System/brands.css`](../3Shamrocks-Studio/Design-System/brands.css),
v3.1.0) — layered on the shared token architecture, component library, accessibility
baseline, and logo/legal rules. The UI is generated *from* this brand.

**Version 1.0 · © 2026 3Shamrocks Studio. All rights reserved.**

---

## Essence

A **TV game show in your hand.** Spotlights, a spinning wheel, a crowd that cheers
when you win — but the prizes are real and the scoring is incorruptible. Royale
**violet** for the spotlight, game-show **gold** for the stars and the crown.

## Persona — "The Host"

Every piece of copy is the voice of a warm, hyped family game-show host. The Host:

- **Brings the energy.** Big moments get big reactions. "JACKPOT!", "You're on!",
  "Round 1 — go!"
- **Is fair to a fault.** The Host *runs* the game but never *rigs* it. This is the
  brand expression of the integrity rule: the engine scores everything, no human
  hands out points. Copy says so plainly — "The game sets every star."
- **Is kid-friendly, never babyish.** It reads for an 8-year-old *and* an 18-year-old
  and a tired parent. No baby-talk, no condescension.
- **Roots for the player.** Celebrates wins, softens losses ("the chore never
  disappears — you still earn its stars"), never shames.
- **Is tight.** Short, active, punchy. A line should fit on a buzzer.

Inherits the 3S studio voice (clear over clever · human, not robotic · encouraging ·
tight) and dials the energy up for the show.

### Voice in practice
| Don't (flat / robotic / babyish) | Do (The Host) |
|---|---|
| "No records found." | "No chores yet — spin to win one! 🎡" |
| "Task submitted for approval." | "Sent to Dad to confirm ✓" |
| "You lost the match." | "Dean takes the round — your turn's coming!" |
| "Invalid: insufficient balance." | "Need ⭐ 12 more for that — keep finishing chores!" |
| "Purchase subscription." | "Unlock the whole show — Chore Royale Plus 👑" |

## Color — 3SDS tokens (measured AA)

| Role | Light | Notes |
|---|---|---|
| Brand / accent (`--brand-600`) | `#6a21c4` royale violet | white text **7.99:1** |
| Accent, dark (`--brand-400`) | `#8a4fe6` | white text **4.84:1** |
| Signature (`--signature-500`) | `#f59e0b` game-show gold | fill/glyph only; dark-on-gold **9.37:1** |
| Neutrals | violet-tinted (`--tint:#3b2d63`) | one knob drives the grey ramp |
| Status | shared AA-safe `--success / --warning / --danger / --info` | gold is never a state |

All colour in the product comes from **semantic tokens** (`--bg --surface --text*
--accent* --border* --success/--warning/--danger/--info`). No raw hex in component code.

## Type — 3SDS scale

- **Display: Fredoka** (rounded, bubbly — the game-show marquee), `--display-weight:600`.
- **Body: Nunito** (clean, friendly, highly readable for kids).
- Sizes/weights/leading come from the shared scale (`--text-xs … --text-7xl`).

## Form

- **Corners:** `--radius-unit:16px` — round and friendly (not pillowy-babyish).
- **Motion:** `--dur-scale:1.1` with a springy ease — bouncy game-show energy;
  collapses under `prefers-reduced-motion`.
- **Elevation:** violet-tinted shadows (`--shadow-color:36 20 64`).

## Components

Built from the 3SDS Layer-3 library — `.btn`, `.card`, `.badge`, `.chip`, `.toast`,
`.modal`, `.avatar`, `.progress`, `.segmented`, `.switch`, `.empty`, `.list-row` — plus
token-only game pieces (the wheel, the battle arena, the splat) that consume **only**
Layer 0 + 2 tokens. Same patterns as every 3S product; the brand decides how they look.

## Logo & legal

Per [RULES.md R2–R3](../3Shamrocks-Studio/Design-System/RULES.md): the product's own
crest is the hero; the **studio** mark is the quiet Shomer-standard footer — real
`3shamrocks.png` (light surfaces: `3shamrocks_black.png`, dark: `3shamrocks.png`),
~13–15px, low opacity, with `© 2026 3Shamrocks Studio. All rights reserved.` Never
fabricated, boxed, or recoloured.

## Gate

Every screen passes [COMPLIANCE.md](../3Shamrocks-Studio/Design-System/COMPLIANCE.md)
and scores **≥ 90** on `ds-audit.py` before it's "done."
