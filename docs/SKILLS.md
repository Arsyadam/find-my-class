# Cursor skills (Karpathy + Apple HIG)

This repo mirrors agent skills under `.cursor/` so Cloud Agents and local Cursor checkouts share the same guidance.

## In this repository

| Pack | Path |
|---|---|
| Karpathy guidelines (rule) | `.cursor/rules/karpathy-guidelines.mdc` |
| Karpathy guidelines (skill) | `.cursor/skills/karpathy-guidelines/` |
| Apple Human Interface skills | `.cursor/skills/apple-human-interface-skills/` |

Sources:

- https://github.com/multica-ai/andrej-karpathy-skills
- https://github.com/sankalpaacharya/apple-human-interface-skills

## Global install (all projects on your machine)

Cloud Agent VMs cannot write into your real laptop `~/.cursor` for “all projects.” That install must run on the machine where Cursor Desktop loads skills.

From the repo root on your machine:

```bash
./scripts/install-cursor-skills.sh
```

The script copies:

- `.cursor/rules/karpathy-guidelines.mdc` → `~/.cursor/rules/`
- `.cursor/skills/karpathy-guidelines/` → `~/.cursor/skills/`
- `.cursor/skills/apple-human-interface-skills/` → `~/.cursor/skills/`

Optional env:

- `CURSOR_HOME` (default `~/.cursor`)
- `REPO_ROOT` (default: parent of `scripts/`)

Restart Cursor (or reload the window) after installing so new skills and rules are picked up.
