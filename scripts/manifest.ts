import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join } from "node:path";

const MANIFEST_NAME = "MANIFEST.sha256";

class ManifestError extends Error {
  override readonly name = "ManifestError";
}

function repositoryRoot(): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
}

function trackedPaths(root: string): string[] {
  const output = execFileSync("git", ["ls-files", "--cached", "-z"], {
    cwd: root,
  });
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(output);
  } catch (error) {
    throw new ManifestError("tracked paths must be valid UTF-8", { cause: error });
  }

  const paths: string[] = [];
  for (const path of decoded.split("\0")) {
    if (path.length === 0 || path === MANIFEST_NAME) {
      continue;
    }
    if (path.includes("\n") || path.includes("\r")) {
      throw new ManifestError(`tracked path cannot contain a newline: ${JSON.stringify(path)}`);
    }
    if (isAbsolute(path) || path === ".." || path.startsWith("../")) {
      throw new ManifestError(`tracked path is not repository-relative: ${JSON.stringify(path)}`);
    }
    paths.push(path);
  }
  return paths.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function renderManifest(root: string, paths: readonly string[]): string {
  return paths
    .map((path) => {
      const absolutePath = join(root, path);
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        throw new ManifestError(`tracked file is missing from the worktree: ${path}`);
      }
      return `${sha256(absolutePath)}  ./${path}\n`;
    })
    .join("");
}

function generate(root: string): void {
  const paths = trackedPaths(root);
  const destination = join(root, MANIFEST_NAME);
  const temporary = join(root, `.${MANIFEST_NAME}.${process.pid}.${randomUUID()}`);
  try {
    writeFileSync(temporary, renderManifest(root, paths), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    chmodSync(temporary, 0o644);
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log(`generated ${MANIFEST_NAME}: ${paths.length} tracked files`);
}

function parseManifest(root: string): Map<string, string> {
  const manifestPath = join(root, MANIFEST_NAME);
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    throw new ManifestError(`${MANIFEST_NAME} is missing`);
  }
  const entries = new Map<string, string>();
  const text = readFileSync(manifestPath, "utf8");
  const lines = text.length === 0 ? [] : text.replace(/\r?\n$/, "").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (line.length < 69 || line.slice(64, 68) !== "  ./") {
      throw new ManifestError(`${MANIFEST_NAME}:${lineNumber}: invalid checksum line`);
    }
    const digest = line.slice(0, 64);
    const path = line.slice(68);
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new ManifestError(`${MANIFEST_NAME}:${lineNumber}: invalid SHA-256 digest`);
    }
    if (path.length === 0 || path.includes("\n") || path.includes("\r")) {
      throw new ManifestError(`${MANIFEST_NAME}:${lineNumber}: invalid tracked path`);
    }
    if (entries.has(path)) {
      throw new ManifestError(`${MANIFEST_NAME}:${lineNumber}: duplicate path: ${path}`);
    }
    entries.set(path, digest);
  }
  return entries;
}

function verify(root: string): void {
  const expectedPaths = trackedPaths(root);
  const expected = new Set(expectedPaths);
  const entries = parseManifest(root);
  const problems: string[] = [];

  for (const path of [...expected].sort()) {
    if (!entries.has(path)) {
      problems.push(`missing manifest entry: ${path}`);
      continue;
    }
    const absolutePath = join(root, path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      problems.push(`tracked file is missing from the worktree: ${path}`);
    } else if (sha256(absolutePath) !== entries.get(path)) {
      problems.push(`checksum mismatch: ${path}`);
    }
  }
  for (const path of [...entries.keys()].sort()) {
    if (!expected.has(path)) {
      problems.push(`manifest entry is not tracked: ${path}`);
    }
  }
  if (problems.length > 0) {
    throw new ManifestError(problems.join("\n"));
  }
  console.log(
    `validated ${MANIFEST_NAME}: ${expectedPaths.length} tracked files and checksums`,
  );
}

function main(args: readonly string[]): number {
  if (args.length === 1 && (args[0] === "-h" || args[0] === "--help")) {
    console.log("usage: manifest.ts {generate|check}");
    return 0;
  }
  if (args.length !== 1 || !["generate", "check"].includes(args[0] ?? "")) {
    console.error("usage: manifest.ts {generate|check}");
    return 2;
  }
  try {
    const root = repositoryRoot();
    if (args[0] === "generate") {
      generate(root);
    } else {
      verify(root);
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`manifest error: ${message}`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
