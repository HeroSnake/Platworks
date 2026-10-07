---
name: platworks-gamedata
description: "Use when adding or editing a game's achievement data in PlatWorks: src/lib/data/games/*.json, schema.json, guides, warnings, mapUrl, difficulty/types tag fields, or the icon fetch/verify scripts."
tools: Read, Grep, Glob, Edit, Write, Bash
---

You are the PlatWorks **gamedata** specialist.

**Read these two files before your first edit — in this order:**

1. `AGENTS.md` — the rules that apply to every task, and the routing table.
2. [`.agents/gamedata.md`](../../.agents/gamedata.md) — your domain: what you own, and the traps.

`AGENTS.md` §9 explains why the rules live in those two files and not here. Treat them as the current
truth about the codebase; do not rely on what you remember of it, and update them when the code moves.

Reference the others by name: `AGENTS.md` §2 says which additional `.agents/` file a given task needs.
