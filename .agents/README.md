# Agent adapters

The rules for this project live in exactly two places:

- [`AGENTS.md`](../AGENTS.md) — the entry point: cross-cutting rules, architecture map, routing table.
- `.agents/*.md` — one file per domain.

Everything in `.github/`, `.cursor/` and `.claude/` is an **adapter**. An adapter exists only because a
particular tool's loader insists on a file at a particular path with a particular frontmatter shape. It
says *where the rules are*. It never restates them.

## Why thin adapters, not copied rules

An adapter that repeats a rule creates a second source of truth. Two copies drift, and the next agent
reads whichever one it happened to load. Keeping the knowledge in one file means a rule is edited once
and every tool is correct immediately — including the tools you are not currently running.

The test: **if you deleted every adapter except `AGENTS.md`, would this repo lose any rule?** If yes, a
rule is in the wrong place. Move it to `AGENTS.md` or `.agents/`.

## What each tool loads

| Tool | Loads automatically | Adapter directory |
|---|---|---|
| Copilot / VS Code | `AGENTS.md`, plus `.github/instructions/*.instructions.md` whose `applyTo` glob matches the file in context | `.github/` |
| Cursor | `AGENTS.md`, plus `.cursor/rules/*.mdc` with a matching `globs` entry, or `alwaysApply: true` | `.cursor/` |
| Claude Code | `AGENTS.md`, `CLAUDE.md`, plus `.claude/agents/*.md` when that subagent is invoked | `.claude/` |
| Codex CLI, Aider, Cline, any `AGENTS.md` reader | `AGENTS.md` | *none needed* |

If a tool reads `AGENTS.md` on its own, it needs no adapter at all. That is the point of choosing
`AGENTS.md` as the canonical filename.

## Templates

### Copilot — `.github/instructions/<domain>.instructions.md`

```markdown
---
applyTo: "src/lib/components/**, src/app.css"
description: "UI layer rules for PlatWorks"
---

Read `.agents/ui.md` before editing anything that matches this glob. It owns component, Tailwind,
animation and tap-target rules. The cross-cutting rules in `AGENTS.md` apply too.
```

`applyTo` is a comma-separated glob list matched against the file being edited. `tools` may also be set
to restrict which tools the file applies to; leave it unset so the agent keeps everything it needs.

### Cursor — `.cursor/rules/<domain>.mdc`

````markdown
---
description: "UI layer rules for PlatWorks"
globs: src/lib/components/**, src/app.css
alwaysApply: false
---

Read `.agents/ui.md` before editing anything matching this glob. Cross-cutting rules: `AGENTS.md`.
````

Use `alwaysApply: true` with **no** `globs` only for something every task needs. `AGENTS.md` already
covers that, so in practice every rule here is glob-scoped.

### Claude Code — `.claude/agents/<domain>.md`

```markdown
---
name: platworks-ui
description: "Use when changing anything a user sees or touches in PlatWorks."
tools: Read, Grep, Glob, Edit, Write, Bash
---

You are the PlatWorks UI specialist.

**Read these first, every time, before your first edit:**

1. `AGENTS.md` — the rules that apply to every task.
2. `.agents/ui.md` — your domain.

Then do the work. Do not answer from memory of the codebase: the domain file is the current truth.
```

`.claude/commands/<name>.md` uses the same idea — a slash command whose body tells the agent which
workflow prompt to follow. The workflow itself lives once, in `.github/prompts/`.

## Adding a domain

1. Write `.agents/<domain>.md`.
2. Add a row to the routing table in `AGENTS.md` §2.
3. Add one adapter per tool that needs one (above). Skip any tool that reads `AGENTS.md` alone.
4. Run `npm run check` if you touched anything outside this directory.