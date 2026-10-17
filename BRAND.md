# Chore Royale™ — Brand World (v2 · Knight)

The whole look is built from **Dave's knight logo**: a crowned violet-and-gold armored knight
with a giant (dirty) silver spoon, soap bubbles, mini crowns and a chunky beveled gold
**CHORE ROYALE** wordmark on a violet shield plate, over deep violet with a teal glow.
It is still a **3S Design System (3SDS) theme** (`[data-brand="choreroyale"]`): semantic
tokens, shared components, AA baseline. v2 replaces the v1 "TV game show" look.

**Version 2.0 · © 2026 3Shamrocks Studio. All rights reserved.**

---

## Essence

**Chores are quests. Kids are knights. Home is the castle.** Every family member is a knight of
the household realm. Each day you spin the Royal Wheel for a quest, beat the clock in a Speed
Run, and a parent (the Crown) approves it. Together the family drives out **Balagan**, the
Mess Monster, and his weekly minion. The best knight of the week wears the **Crown**.

## The lore (v2)

| Thing | Name | Hebrew | Notes |
|---|---|---|---|
| Your home | **the Castle** | הטירה | Nav tab "Castle"; WhatsApp recap "Today in the castle" |
| Every player | **Knight** | אביר / אבירה | Kids *and* parents. Never "princess/king" roles; anyone can be any rank |
| Mascot | **Sir Spoonalot** | סר כפית | The logo knight. Mentor and cheerleader, never the judge |
| His weapon | **the Royal Spoon** | הכף המלכותית | The quest icon. Dirty spoon = a quest not done yet |
| Villain | **Balagan, the Mess Monster** | בלגן | A cheeky cloud of crumbs, odd socks and lost lids. Silly, never scary |
| His minions (one a week) | 🐰 Dust Bunny Swarm · 🐉 Dish Dragon · 🐙 Bathtub Kraken · 👹 Trash Troll · 🧦 Sock Goblin · 🥀 Wilt Wraith · 🐾 Mud Mutt · 👻 Smudge Ghost | | One per built-in quest (same order as `CHORES`); the week's minion is the chore the family did least last week |
| Parents approving | **the Crown** | הכתר | "Sent to Dana ✓", "The Crown was busy — the game approved 1 chore" |
| Daily spin | **the Royal Wheel** | הגלגל המלכותי | Spin o'clock = the daily reminder |
| Timed quest | **Speed Run** | ריצת מהירות | +50% XP if you beat the clock; late still earns full XP |
| Weekly #1 | **the Crown** (this week's) | כתר השבוע | "Crown this week's champion" |
| Streak saver | **Royal Pardon** / **Rest Day** | חנינה מלכותית / יום מנוחה | Forgiveness, not punishment |

**Ranks (lifetime XP)** — 🧽 Squire (0) → 🛡️ Knight (500) → 🥄 Mess Buster (1,200) →
🏰 Royal Guard (2,500) → 🏆 Champion (4,500) → 👑 Legend (7,000).

### Voice — "the Herald"

Warm, hyped, fair. Short lines a 6-year-old can read and a 14-year-old won't cringe at.

- **Beat, chase out, clean up** — never slay, kill, destroy. Balagan *retreats*, he doesn't die.
- **The game sets every star.** No one hands out points by hand; the Crown only approves.
- **Roots for the knight.** Losses soften ("your turn's coming"), streaks pause, nobody is shamed.
- **Inclusive.** Everyone is a knight. No gendered ranks, no "chores for girls/boys".

| Don't | Do |
|---|---|
| "No records found." | "No quests yet — spin the Royal Wheel! 🎡" |
| "Task submitted for approval." | "Sent to Dad ✓" |
| "You lost." | "Dean wears the Crown this week — your turn's coming!" |
| "Slay the monster!" | "Chase Balagan's Sock Goblin out of the castle!" |
| "Purchase subscription." | "Unlock more of the realm — Chore Royale Plus 👑" |

## Color — tokens from the logo (measured WCAG)

| Role | Token | Hex | Contrast (measured) |
|---|---|---|---|
| Scene background | `--royal-900` | `#14072a` | white 19.2:1 |
| Surface / plate | `--royal-800` / `--royal-700` | `#231045` / `#3a1a70` | `--tx2` 7.0:1 on 700 |
| Brand violet (armor) | `--royal-500` | `#6a2fc0` | white 7.6:1 |
| Outline ink (wordmark stroke) | `--ink` | `#2a0e4f` | used for 2–3px outer strokes + bevel ledges |
| Crown gold (primary CTA) | `--gold-400` | `#f4c04b` | `--gold-900 #3b1d02` text 9.2:1 |
| Gold highlight / text on violet | `--gold-300` | `#ffd66b` | 12.3:1 on royal-800 |
| Hero glow (accent, success) | `--teal-400` / `--teal-300` | `#3ee6cf` / `#8ff7e9` | teal-300 14.5:1 on royal-850 |
| Villain / mess | `--mess-400` | `#ff8a9a` | 6.0:1 on royal-700 |
| Text ramp | `--tx0/1/2/3` | `#fff` `#e6ddfa` `#c2b4e6` `#a593d0` | tx3 ≥ 6.7:1 on every dark surface |

Rules: deep violet is the brand (never a dark-green theme). Gold = primary action and
"you earned it". Teal = glow, success, Speed Run. Coral-pink = Balagan only. Every status keeps
an icon + word, never colour alone. All colour comes from tokens in `index.html :root`.

Gradients: `--grad-gold` (beveled CTA), `--grad-royal`, `--grad-teal`, `--grad-plate`, `--scene`.

## Type

- **Display: Lilita One** — chunky, rounded-slab, the closest free match to the beveled
  wordmark; used for titles, buttons, numbers. Gold titles get the wordmark treatment
  (gold gradient + 2px `--ink` drop outline) via `.gold-text`.
- **Body: Nunito** 600–900 for readability; **Fredoka** loaded as the fallback that covers
  **Hebrew** (Nunito/Lilita have no Hebrew glyphs).
- Minimum body text 12px, 700 weight on dark; kid-facing copy 13.5–15px.

## Form & motifs

- **Shield plates:** cards are violet plates with a gold-tinted 2px border and an inner `--ink`
  ring (`inset 0 0 0 2px var(--ink)`), radius 16–22px.
- **Bevel:** gold buttons = gold gradient + white top inset + dark-gold bottom inset + 5px `--ink`
  ledge. Press = translate 3px down, ledge shrinks.
- **Gems:** the violet diamond-in-gold from the plate marks section titles, the active nav tab
  and PIN dots.
- **Spoon:** the quest icon (nav "Quests", "Today's Quests").
- **Soap bubbles:** ambient texture on every screen (very low opacity) and the **success** effect
  (reward screen, villain beaten, toasts). Bubbles = clean = winning.
- **Medallions:** emoji avatars and quest icons sit in round violet medallions with a gold ring.
- **Motion:** springy pops, rising bubbles; all collapse under `prefers-reduced-motion`.

## Mascot usage (Sir Spoonalot)

Use the cutout (`assets/brand/knight.webp`, png fallback) at **key moments only**: onboarding
(full lockup), the home quest banner, Quest Time / Speed Run ("You've got this, knight!"),
reward, villain beaten, weekly Crown. Not in lists, not in every card. Never recolour, flip
or crop through the helmet. Small sizes (< 64px) use the knight-bust icon tile instead.

## Assets (`assets/brand/`, generated from the logo)

| File | Use | Size |
|---|---|---|
| `knight.webp` / `knight.png` | mascot cutout (440w / 330w) | 31 KB / 28 KB |
| `lockup.webp` / `lockup.png` | transparent full logo (knight + plate): onboarding, desktop wall | 65 KB / 67 KB |
| `lockup.jpg` | opaque full logo for `og:image` link previews | 72 KB |
| `wordmark.webp` / `wordmark.png` | CHORE ROYALE plate: home header, Plus modal | 28 KB / 39 KB |
| `favicon-32.png`, `favicon-16.png` | crown + helmet | 2 KB / 1 KB |
| `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`, `/assets/apple-touch-icon.png` | knight bust on a violet tile with teal glow (maskable keeps the bust inside the 80% safe zone) | 21 / 108 / 99 / 18 KB |

Source logo: `qa-chore/brand/chore-royale-knight-logo.jpg`. Cutout = rembg masks (u2net +
isnet) as GrabCut seeds, teal-fringe and foam cleanup, soft fade where the plate starts.

## Logo & legal

The product's own crest (the knight lockup) is the hero; the **studio** mark stays the quiet
3SDS footer — real `3shamrocks.png` (dark surfaces) / `3shamrocks_black.png` (light), ~13–15px,
low opacity, `© 2026 3Shamrocks Studio. All rights reserved.` Never fabricated or recoloured.

## Gate

Every screen: AA contrast, no horizontal scroll at 360/390/412, zero console errors, and the
existing QA suites (`qa_multiplayer.py`, `qa_retention.py`) green before it's "done".
