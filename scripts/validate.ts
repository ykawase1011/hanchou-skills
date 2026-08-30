import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function trackedPaths(): string[] {
  return execFileSync("git", ["ls-files", "--cached", "-z"], { cwd: ROOT })
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0);
}

function parseFrontmatter(path: string): Map<string, string> {
  const text = readFileSync(path, "utf8");
  if (!text.startsWith("---\n")) {
    throw new Error(`missing YAML frontmatter: ${relative(ROOT, path)}`);
  }
  const closing = text.indexOf("---\n", 4);
  if (closing < 0) {
    throw new Error(`invalid YAML frontmatter: ${relative(ROOT, path)}`);
  }
  const result = new Map<string, string>();
  for (const line of text.slice(4, closing).split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^"|"$/g, "");
    result.set(key, value);
  }
  return result;
}

function validateMigrationInvariants(tracked: readonly string[]): void {
  const pythonSources = tracked.filter((path) => path.endsWith(".py"));
  if (pythonSources.length > 0) {
    throw new Error(`Python source remains after the TypeScript migration: ${pythonSources.join(", ")}`);
  }

  const mise = readFileSync(join(ROOT, "mise.toml"), "utf8");
  if (
    /^\s*(?:(?:tools\s*\.)?python|"python"|'python')\s*=/im.test(mise) ||
    /^\s*\[\s*tools\s*\.\s*(?:python|"python"|'python')\s*\]/im.test(mise)
  ) {
    throw new Error("mise.toml must not configure a Python runtime");
  }

  const runtimePaths = tracked.filter(
    (path) =>
      path !== "scripts/validate.ts" &&
      (path === "Makefile" ||
        path.startsWith("scripts/") ||
        path.startsWith("tests/") ||
        path.startsWith(".github/workflows/")),
  );
  const pythonReferences = runtimePaths.filter((path) =>
    /(^|[^A-Za-z0-9_])python(?:3(?:\.\d+)?)?([^A-Za-z0-9_]|$)/i.test(
      readFileSync(join(ROOT, path), "utf8"),
    ),
  );
  if (pythonReferences.length > 0) {
    throw new Error(
      `Python execution reference remains after the TypeScript migration: ${pythonReferences.join(", ")}`,
    );
  }
}

function main(): void {
  const trackedPathsInRepository = trackedPaths();
  validateMigrationInvariants(trackedPathsInRepository);

  const version = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`invalid VERSION: ${version}`);
  }

  const skills: string[] = [];
  for (const entry of readdirSync(join(ROOT, "skills"), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory()) {
      continue;
    }
    const path = join(ROOT, "skills", entry.name, "SKILL.md");
    if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`missing SKILL.md: skills/${entry.name}`);
    }
    const meta = parseFrontmatter(path);
    if (meta.get("name") !== entry.name) {
      throw new Error(`skill name mismatch: ${entry.name} != ${String(meta.get("name"))}`);
    }
    if (!meta.get("description")) {
      throw new Error(`missing skill description: ${entry.name}`);
    }
    skills.push(entry.name);
  }

  if (skills.includes("hanchou-mailbox")) {
    throw new Error("obsolete hanchou-mailbox skill must not exist");
  }
  const required = [
    "hanchou-cli",
    "hanchou-orchestrator",
    "hanchou-relay",
    "hanchou-reporting",
  ];
  const missing = required.filter((name) => !skills.includes(name));
  if (missing.length > 0) {
    throw new Error(`missing required skills: ${JSON.stringify(missing.sort())}`);
  }

  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  for (const name of skills) {
    if (!readme.includes(`\`${name}\``)) {
      throw new Error(`README does not list skill: ${name}`);
    }
  }

  const tracked = trackedPathsInRepository
    .map((path) => readFileSync(join(ROOT, path), "utf8"))
    .join("\n");
  const forbidden = new Map<string, RegExp>([
    ["Slack token", /xox[baprs]-[A-Za-z0-9-]+/],
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["credential assignment", /^\s*(?:token|password|client_secret|private_key)\s*=/im],
  ]);
  for (const [label, pattern] of forbidden) {
    if (pattern.test(tracked)) {
      throw new Error(`forbidden ${label} in public Skill repository`);
    }
  }

  console.log(`validated ${skills.length} Skills at version ${version}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
