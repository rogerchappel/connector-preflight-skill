import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const quickstart = readme.match(/## Quickstart\s+```bash\n([\s\S]*?)\n```/);
assert.ok(quickstart, "README must contain a bash Quickstart block");
assert.match(quickstart[1], /fixtures\/action\.pass\.json/, "primary Quickstart must use the pass fixture");
assert.match(quickstart[1], /connector-preflight\.js inspect/, "primary Quickstart must reach inspect");
assert.match(quickstart[1], /npm run release:check/, "primary Quickstart must reach release:check");

const approval = readme.match(/### Needs-approval example[\s\S]*?```bash\n([\s\S]*?)\n```/);
assert.ok(approval, "README must contain a separate needs-approval example");
assert.match(approval[1], /expected status: 2/);

const staging = mkdtempSync(join(tmpdir(), "connector-preflight-docs-"));
try {
  const packJson = execFileSync("npm", ["pack", "--json", "--pack-destination", staging], { encoding: "utf8" });
  const [{ filename }] = JSON.parse(packJson);
  execFileSync("tar", ["-xzf", join(staging, filename), "-C", staging]);
  const packagedReadme = readFileSync(join(staging, "package", "README.md"), "utf8");
  assert.equal(packagedReadme, readme, "packed package must contain the corrected README");

  const primary = spawnSync("bash", ["-euo", "pipefail", "-c", quickstart[1]], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, CONNECTOR_PREFLIGHT_QUICKSTART_NESTED: "1" }
  });
  assert.equal(primary.status, 0, primary.stderr || primary.stdout);
  assert.match(primary.stdout, /crm-lite/, "inspect output proves the inspect step ran");
  assert.match(primary.stdout, /package smoke ok/, "release output proves the release:check step ran");

  const needsApproval = spawnSync("bash", ["-euo", "pipefail", "-c", approval[1]], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(needsApproval.status, 2, needsApproval.stderr || needsApproval.stdout);
  assert.match(needsApproval.stdout, /needs-approval/);
} finally {
  rmSync(staging, { recursive: true, force: true });
}

console.log("documentation smoke ok: Quickstart completed and needs-approval exited 2");
