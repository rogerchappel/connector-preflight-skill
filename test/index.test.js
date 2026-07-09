import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inspectConnectors, preflight, renderMarkdown } from "../src/index.js";

const manifest = JSON.parse(readFileSync(new URL("../fixtures/connectors.json", import.meta.url), "utf8"));
const passAction = fixture("action.pass.json");
const approvalAction = fixture("action.needs-approval.json");
const missingScopeAction = fixture("action.missing-scope.json");
const blockedAction = fixture("action.blocked.json");

test("inspect lists connector capabilities", () => {
  const connectors = inspectConnectors(manifest);
  assert.equal(connectors[0].id, "crm-lite");
  assert.deepEqual(connectors[0].capabilities, ["contact.read", "contact.update", "contact.delete"]);
});

test("preflight passes read-only dry-run action", () => {
  assert.equal(preflight(manifest, passAction).verdict, "pass");
});

test("preflight requires approval for side-effecting capability", () => {
  const report = preflight(manifest, approvalAction);
  assert.equal(report.verdict, "needs-approval");
  assert.match(report.findings.join("\n"), /Approval required/);
});

test("preflight detects missing scopes", () => {
  const report = preflight(manifest, missingScopeAction);
  assert.equal(report.verdict, "missing-scope");
  assert.match(report.findings.join("\n"), /Missing scopes/);
});

test("preflight blocks manifest-blocked capabilities", () => {
  const report = preflight(manifest, blockedAction);
  assert.equal(report.verdict, "blocked");
});

test("markdown render includes stop conditions", () => {
  const rendered = renderMarkdown(preflight(manifest, approvalAction));
  assert.match(rendered, /# Connector Preflight: crm-lite/);
  assert.match(rendered, /Obtain explicit approval/);
});

test("CLI inspect works with fixture manifest", () => {
  const output = execFileSync("node", ["bin/connector-preflight.js", "inspect", "fixtures/connectors.json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.match(output, /crm-lite/);
});

test("CLI exposes help and version metadata", () => {
  const cwd = new URL("..", import.meta.url);
  const help = execFileSync("node", ["bin/connector-preflight.js", "--help"], {
    cwd,
    encoding: "utf8"
  });
  assert.match(help, /connector-preflight inspect/u);

  const version = execFileSync("node", ["bin/connector-preflight.js", "--version"], {
    cwd,
    encoding: "utf8"
  });
  assert.equal(version, "0.1.0\n");
});

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}
