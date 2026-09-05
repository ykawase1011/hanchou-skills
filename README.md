# hanchou-skills (deprecated)

This repository is no longer a Hanchou v3 dependency and is ready to archive.

The canonical Hanchou orchestrator skill moved to:

- repository: <https://github.com/ykawase1011/hanchou>
- path: `skills/hanchou-orchestrator`
- project-local install:

```bash
npx skills add https://github.com/ykawase1011/hanchou \
  --skill hanchou-orchestrator --agent universal claude-code --local
```

Legacy orchestration, task, relay, schedule, worker, mission-lead, reviewer,
reporting, and routing skills were removed rather than retained as compatibility
layers. Git history and v2 tags preserve their source.

The former writer/editor snippets were not retained as Hanchou core because
they are general prose roles, not Orca orchestration mechanics. They may return
in a separate general-purpose catalog if independently maintained.
