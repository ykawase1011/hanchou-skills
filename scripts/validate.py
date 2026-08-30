#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text()
    if not text.startswith("---\n"):
        raise SystemExit(f"missing YAML frontmatter: {path.relative_to(ROOT)}")
    try:
        header = text.split("---\n", 2)[1]
    except IndexError as exc:
        raise SystemExit(f"invalid YAML frontmatter: {path.relative_to(ROOT)}") from exc
    result: dict[str, str] = {}
    for line in header.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip('"')
    return result


def main() -> None:
    version = (ROOT / "VERSION").read_text().strip()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise SystemExit(f"invalid VERSION: {version}")

    skills = []
    for skill_dir in sorted((ROOT / "skills").iterdir()):
        if not skill_dir.is_dir():
            continue
        path = skill_dir / "SKILL.md"
        if not path.exists():
            raise SystemExit(f"missing SKILL.md: {skill_dir.relative_to(ROOT)}")
        meta = parse_frontmatter(path)
        if meta.get("name") != skill_dir.name:
            raise SystemExit(f"skill name mismatch: {skill_dir.name} != {meta.get('name')}")
        if not meta.get("description"):
            raise SystemExit(f"missing skill description: {skill_dir.name}")
        skills.append(skill_dir.name)

    if "hanchou-mailbox" in skills:
        raise SystemExit("obsolete hanchou-mailbox skill must not exist")
    required = {"hanchou-cli", "hanchou-orchestrator", "hanchou-relay", "hanchou-reporting"}
    missing = required.difference(skills)
    if missing:
        raise SystemExit(f"missing required skills: {sorted(missing)}")

    readme = (ROOT / "README.md").read_text()
    for name in skills:
        if f"`{name}`" not in readme:
            raise SystemExit(f"README does not list skill: {name}")

    tracked = "\n".join(path.read_text(errors="replace") for path in ROOT.rglob("*") if path.is_file())
    forbidden = {
        "Slack token": r"xox[baprs]-[A-Za-z0-9-]+",
        "private key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        "credential assignment": r"(?im)^\s*(?:token|password|client_secret|private_key)\s*=",
    }
    for label, pattern in forbidden.items():
        if re.search(pattern, tracked):
            raise SystemExit(f"forbidden {label} in public Skill repository")

    print(f"validated {len(skills)} Skills at version {version}")


if __name__ == "__main__":
    main()
