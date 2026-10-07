---
description: "Use when creating git commits, writing commit messages, or choosing a Conventional Commits type/scope for PlatWorks. Always English."
tools: [read, edit, search, execute]
---

# PlatWorks — git commits

**You own:** commit message format, type/scope vocabulary, and language rules for every commit in this repo.

**Always paired with:** [AGENTS.md](../AGENTS.md). Do not invent a parallel style in README or chat — this file is the source of truth.

---

## 1. Hard rules

1. **English only.** Subjects, bodies, and footers are always written in English — never French or mixed language.
2. **Conventional Commits 1.0.0.** Every message matches:
   ```
   <type>(<optional scope>): <short description>

   <optional body>

   <optional footer>
   ```
3. **Subject line:** imperative mood, no trailing period, ~72 characters max. Describe the *why* / outcome, not a file list.
4. **Body (when needed):** wrap near 72–100 chars; explain motivation, trade-offs, and anything a future agent must not undo. Bullet lists are fine.
5. **One logical change per commit** when practical. Unrelated work (e.g. a game pack + an unrelated refactor) should be split unless the user explicitly asks for a single combined commit.
6. **Never** use `--no-verify`, force-push to `main`/`master`, or rewrite published history unless the user explicitly orders it.

---

## 2. Types

| Type | Use when |
|---|---|
| `feat` | User-visible capability or new game data the catalog gains |
| `fix` | Bug fix (broken images, wrong title, hydration mismatch, …) |
| `docs` | Agent files, README, comments that change durable knowledge only |
| `style` | Formatting / visual styling with no behaviour change (CSS class polish) |
| `refactor` | Internal restructure with no intended behaviour change |
| `perf` | Performance-only change |
| `test` | Tests only |
| `build` | Tooling, Vite, adapters, lockfile, CI config |
| `chore` | Maintenance that does not fit above (ignore noise, tiny cleanup) |

Breaking changes: append `!` after type/scope (`feat(api)!: …`) and add a `BREAKING CHANGE:` footer.

---

## 3. Scopes (optional, preferred when clear)

| Scope | Area |
|---|---|
| `games` | `src/lib/data/games/*`, generate-game-data / icons |
| `steam` | `#lib/server/steam/*`, `/api/steam/*` |
| `ui` | components, `app.css`, layout chrome |
| `library` | home library grid / cards |
| `state` | `platworks:*` localStorage, client profile/library/theme |
| `agents` | `AGENTS.md`, `.agents/*`, `.github/`, `.cursor/`, `.claude/` |
| `deps` | dependency bumps |

Omit the scope when the change spans several areas and none dominates.

---

## 4. Examples

```
feat(games): add Hades and Deep Rock Galactic achievement guides

Includes polished steps, Steam icons, and README catalogue counts.
```

```
fix(steam): keep local artwork paths when appdetails is blocked

Akamai returns Access Denied to Node; returning null left the
library with empty image slots.
```

```
docs(agents): define Conventional Commits rules for future agents
```

---

## 5. Checklist before `git commit`

- [ ] Message is English and matches `<type>(scope): subject`
- [ ] Staged set matches the message (no secrets: `.env`, credentials)
- [ ] Domain agent file + README updated if behaviour/docs changed ([AGENTS.md §1](../AGENTS.md))
- [ ] Prefer HEREDOC / here-string for the message body so formatting stays intact

PowerShell example:

```powershell
git commit -m @"
feat(games): add 17 Steam titles to the catalog

Expand the library with guided achievement data and update README counts.
"@
```
