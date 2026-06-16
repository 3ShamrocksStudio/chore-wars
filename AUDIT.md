# Chore Wars™ — Audit & Rebuild Notes

A blunt assessment of the previous version, and the concrete changes made to turn it
into something a family can actually run their chores with. Function first; the game
layer rebuilt so it rewards **real chore-doing and nothing else**.

---

## What was wrong (honestly)

The previous build was a polished *warrior game* with a chore-shaped skin. The styling
was lovely, but the product underneath couldn't manage chores.

**Function failures (the dealbreakers):**

1. **You couldn't add, edit, or delete a chore.** Every "quest" was hardcoded in the
   app's default state. A parent had no way to create a chore, change it, reassign it,
   or remove it from the UI. That alone makes it unusable as a chore manager.
2. **No real recurrence and no due dates.** Chores were tagged `type:'daily'` but nothing
   ever rolled over to a new day, and there was no weekly / specific-days / one-off option
   and no due date. "Today" never actually changed.
3. **No rooms / categories.**
4. **No sortable or filterable views.** There was no real "Today" vs "This week", no
   "by room", a very thin "by person" (the parent saw counts only), and **no follow-up /
   overdue view at all** — so nothing could be chased up.
5. **Members weren't editable.** Jakob / Dean / Daddy were fixed in code. No add / rename /
   remove, no way to fit a different family.
6. **Status colors were reused across different states.** Teal meant "done" *and* "verified"
   *and* appeared on other UI; "pending" reused the orange brand color. You couldn't tell
   states apart at a glance.

**Game-layer failures (style over function):**

7. **The metaphor obscured the list instead of driving it.** "Raid the boss", "boss health
   24 HP", momentum tiers (Cold → On Fire), an armory of unlockable armor, warrior avatars,
   "slay the quest" copy. The shared "raid" wasn't tied to *everyone finishing their assigned
   chores* — the boss had an arbitrary 24 HP and took 1 damage per quest. Kids had to decode a
   battle metaphor to find out what to actually do.
8. **Heavy theming hurt usability.** Dark raid panels, gradients on gradients, and militaristic
   language made a kids' chore list feel like a confusing RPG menu.

---

## What I changed, and why

### 1. It's now a genuinely usable chore manager (the priority)

- **Full chore CRUD.** A floating **＋ Add chore** button and tap-to-edit on any chore open a
  form with: name, icon, **assignee**, **room/category**, **recurrence (One-off / Daily /
  Weekly / Specific days)** with a weekday picker, **due date** for one-offs, and XP/coins.
  Editing and deleting (with confirmation) live in the same form.
- **A real recurrence + occurrence engine.** Chores are templates; completion is tracked
  per *occurrence* in a `completions` log keyed by date. So "Today" and "This week" are
  computed live from the calendar — daily chores reappear each day, weekly/specific-days
  chores show on the right weekdays, one-offs sit on their due date. Nothing is destructively
  "reset"; history is preserved, which is what makes overdue/missed and weekly progress honest.
- **Clear, sortable, filterable views.** The **Chores** tab has one-tap views: **Today**,
  **This week** (grouped by day, today highlighted), **By person**, **By room**, and **All**.
  Each kid's **Today** tab defaults to *their own* list.
- **A real follow-up view.** The **Follow-up** tab (with a live count badge) shows
  **Awaiting verification** and **Overdue & missed** in two clearly separated sections.
- **Simple, obvious completion flow.** Kid taps ✓ → chore goes **Awaiting verify** (amber) →
  parent approves in Follow-up/Today → **Done** (green), and *only then* are XP + coins applied.
  Parents' own chores self-complete (no one to verify them). A kid can tap an amber chore to undo.
- **Editable members.** Add / edit / remove family members (name, role kid|parent, color,
  emoji avatar). Removing someone reassigns their chores rather than orphaning them.
- **Sensible empty states** for every list, and **distinct status colors**: slate = To-do,
  amber = Awaiting verify, green = Done, red = Overdue. Each status also carries an icon and a
  word, so it never relies on color alone (accessibility).

### 2. The game layer now reinforces real chores

- **Completing a real, verified chore is the only thing that earns anything** — XP, coins,
  weekly progress, leaderboard position. There are no arbitrary side games.
- **The shared campaign maps to a real family goal.** The "raid boss" is replaced by a
  **Family Goal**: *everyone completes their chores this week → unlock the reward (e.g.
  Pizza Night)*. The progress bar is driven by **actual verified completions this week**,
  shows each member's contribution, and pops a celebration when the family hits the target.
  The reward name, icon, and target (Auto = all chores due this week, or a custom number)
  are editable. The metaphor now *points at the list* instead of hiding it.
- **Kept light and fun, dialed back the heavy theme.** Friendly emoji avatars, a confetti
  burst and encouraging copy on completion, a weekly leaderboard — but a clean, calm layout
  and plain language ("Today's chores", "Awaiting verify") instead of warrior RPG menus.
  Color psychology used sensibly: calm blue for primary actions, green for success, amber for
  "waiting on you", red strictly for overdue.

### 3. Branding & technical rules

- **3Shamrocks logo always on a dark-grey panel** (`.brandbox`, `#373B40`) — splash, About,
  and the Me footer — per the brand rule. © 3Shamrocks and **Chore Wars™** retained.
- **Single self-contained HTML**, **localStorage** persistence (new `chorewars_v2` store),
  **no eval**, strict CSP kept. All dynamic/user text is rendered via `textContent` / DOM
  builders (never `innerHTML` of user data), so a chore named `<img onerror=…>` can't inject
  anything. Responsive (max-width app column, mobile-first), keyboard-focusable, reduced-motion
  honored. Service-worker cache bumped to `chorewars-v2-cache` so returning users get the rebuild.

---

## Verified end-to-end (browser preview)

Added a recurring chore ("Wipe kitchen counters", Mon/Wed/Fri, assigned to Dean) → completed a
chore as Jakob (went to *Awaiting verify*, no reward yet) → verified as Daddy (Jakob earned
+15 XP / +4 coins, weekly goal moved 2 → 3) → confirmed By-person and Overdue views → set a
reachable target and watched the Family Goal hit 100% and fire the **Pizza Night unlocked**
celebration. No console errors.
