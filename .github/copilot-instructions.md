# Workspace tool & execution rules

- You have full permission to create, update, and overwrite files in `AGENTS.md`, `.agents/`,
  `.github/`, `.cursor/`, `.claude/` and `.opencode/`.
- When updating agent rules, prompt templates, or codebase architecture notes, apply the changes
  directly to disk without asking for permission or prompting for manual file creation steps.

## Where the rules actually live

The project rules are **not** in this file. Read [`AGENTS.md`](../AGENTS.md) first — it is the entry
point and routes you to the right file in [`.agents/`](../.agents/). This file only adds the workspace
permissions above.

Copilot picks up path-specific rules automatically from `.github/instructions/*.instructions.md`, each
matched by its `applyTo` glob. Those files are thin: they tell you which `.agents/` file to read.
Never write a rule into an adapter — write it in `AGENTS.md` or `.agents/` so every tool sees it.
See [`.agents/README.md`](../.agents/README.md).
