# CLAUDE.md

PlatWorks — a SvelteKit 3 / Svelte 5 runes / Tailwind 4 Steam completionist app.

The project rules are **not** in this file. Read [`AGENTS.md`](AGENTS.md) — it is the entry point and
routes you to the right file in [`.agents/`](.agents/). This file exists only so Claude Code, which
looks for `CLAUDE.md` by name, points you at the same source of truth as every other tool in this repo.

**Read `AGENTS.md` first, every session.** Then read the `.agents/` file it routes you to.

Claude-specific behaviour already lives where Claude Code expects it:

| Concern | File |
|---|---|
| Domain subagents | `.claude/agents/*.md` — one per domain, each pointing at its `.agents/` file |
| Workflow slash commands | `.claude/commands/*.md` — run the prompts in `.github/prompts/` |
| Permissions | `.claude/settings.json` — `.env` and `secrets/` are denied |

Claude Code reads `AGENTS.md` natively, so this file stays short on purpose. `AGENTS.md` §9 explains
why: a rule written twice is a rule that will eventually disagree with itself.
