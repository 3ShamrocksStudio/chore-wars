# 3Shamrocks Studio — chore-wars
> Claude working rules for this repo. All 3S permanent session rules apply on top of these.

## Permanent rules (never override)
1. Nothing goes public without Dave's explicit green light. Deployed = staging only.
2. Tag `NEEDS YOUR EYES` on anything requiring Dave's review/approval.
3. Never send Dave to do dev/tech/console tasks — Claude executes everything technical.
4. CRITICAL: Never rebuild or redesign existing UI unless explicitly asked. Minimal change only.
5. MANDATORY QA GATE before reporting any task complete: syntax-validate, verify deployed state, map every request line to shipped change, report PASS/FAIL.
6. Never call a staged product "launched" or "live".
7. go ahead e2e autonomous proceed = confirmed authorisation to run to completion without check-ins.

## Multi-agent execution rules

### Verifier gate (mandatory)
Before reporting ANY finding or completed fix, spawn an independent verifier Agent (separate context) that re-reads the relevant files from disk. Only report PASS when the verifier independently confirms. Disagreement → fix first, never report until both passes agree.

### Fix loop cap
Same bug survives 2 consecutive fix attempts with no measurable progress → STOP and report. No 3rd attempt without Dave.

### Scan vs patch model routing
- Read-only scans: focused subagent, minimal scope
- Patch/edit passes: minimum-line change, verify diff before committing
- Planning pass: always before any file is touched

### Commit discipline
One commit per logical change. Message: imperative, under 72 chars.
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014tNuHNxs6LXCKPMHdXM6gG
