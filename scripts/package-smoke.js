import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const required = [
  "package.json",
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
];

const output = execFileSync("npm", ["pack", "--json", "--pack-destination", tmpdir()], { encoding: "utf8" });
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));
const missing = required.filter((file) => !files.has(file));
const forbidden = ["scripts/docs-smoke.js", "scripts/release-check.js"];
const shippedForbidden = forbidden.filter((file) => files.has(file));

if (missing.length > 0) {
  throw new Error(`package smoke missing required files: ${missing.join(", ")}`);
}

if (shippedForbidden.length > 0) {
  throw new Error(`package smoke includes repository-only files: ${shippedForbidden.join(", ")}`);
}

const packedManifest = JSON.parse(
  execFileSync("tar", ["-xOf", join(tmpdir(), pack.filename), "package/package.json"], { encoding: "utf8" }),
);
if (
  packedManifest.name !== "connector-preflight-skill" ||
  !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(packedManifest.version) ||
  packedManifest.bin?.["connector-preflight"] !== "./bin/connector-preflight.js"
) {
  throw new Error("package smoke found invalid package manifest name, version, or executable metadata");
}

if (pack.filename) {
  rmSync(join(tmpdir(), pack.filename), { force: true });
}

console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files`);
