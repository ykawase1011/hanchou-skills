# hanchou-skills

Public, shared Agent Skills for Hanchou. This repository is the canonical Skill
source used on company and personal computers. The `hanchou` repository may
vendor a generated snapshot for bootstrap, but changes originate here.

Company-specific or personal policy belongs in separate private Skill
repositories. Do not store credentials, secret values, private keys, cookies,
or confidential project data in Skills.

## Recommended installation

Use `hanchou apply` and the profile's `skills.toml`. It installs control Skills
at project scope, bounded worker Skills at global scope, and Writer/Editor only
to Codex.

For development or a quick all-Skills smoke test:

```bash
npx skills add . \
  --skill '*' \
  --agent codex \
  --agent claude-code \
  --copy \
  --yes
```

Do not use the all-Skills command as the production role boundary. Skill scope
is a guidance boundary, not a security ACL, but narrower installation reduces
accidental capability use.

## Skills

- `hanchou-cli`
- `hanchou-orchestrator`
- `hanchou-task`
- `hanchou-schedule`
- `hanchou-relay`
- `hanchou-reporting`
- `hanchou-usage-routing`
- `hanchou-mission-lead`
- `hanchou-worker`
- `hanchou-reviewer`
- `hanchou-writer`
- `hanchou-editor`

## CLI boundary

`hanchou-cli` is the common command-routing Skill. It keeps Codex and Claude
Code on the same rule:

```text
Task graph                 bd
Agent runtime              herdr
ordinary fresh-agent Cron  herdr-automations
Hanchou-owned/cross-system hanchou
```

## Validation

Node.js 22 is pinned by `mise.toml`. Install the development toolchain once,
then run the type-safe, dependency-free runtime checks:

```bash
mise install
mise exec -- npm ci
make check
```
