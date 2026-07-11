import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const required = [
  "bin/connector-preflight.js",
  "src/index.js",
  "fixtures/connectors.json",
  "fixtures/action.pass.json",
  "fixtures/action.needs-approval.json",
  "fixtures/action.missing-scope.json",
  "fixtures/action.blocked.json",
  "docs/EXAMPLES.md",
  "docs/RELEASE_CANDIDATE.md",
  "docs/SAFETY.md",
  "SKILL.md",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "scripts/package-smoke.js"
];

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" });
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
const missing = required.filter((file) => !files.has(file));

if (missing.length > 0) {
  throw new Error(`package smoke missing required files: ${missing.join(", ")}`);
}

if (pack.filename) {
  rmSync(pack.filename, { force: true });
}

console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files`);
