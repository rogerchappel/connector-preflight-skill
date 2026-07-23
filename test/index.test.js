import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("preflight blocks incomplete and wrongly typed action requests", () => {
  const cases = [
    [{ capability: "contact.read", scopes: [], approval: "not-required", dryRun: true }, /action\.connector must be a non-empty string/],
    [{ connector: "crm-lite", scopes: [], approval: "not-required", dryRun: true }, /action\.capability must be a non-empty string/],
    [{ connector: "crm-lite", capability: "contact.read", approval: "not-required", dryRun: true }, /action\.scopes must be an array/],
    [{ connector: "crm-lite", capability: "contact.read", scopes: "contacts:read", approval: "not-required", dryRun: true }, /action\.scopes must be an array/],
    [{ connector: "crm-lite", capability: "contact.read", scopes: [1], approval: "not-required", dryRun: true }, /action\.scopes must contain only non-empty strings/],
    [{ connector: "crm-lite", capability: "contact.read", scopes: [], dryRun: true }, /action\.approval must be one of/],
    [{ connector: "crm-lite", capability: "contact.read", scopes: [], approval: true, dryRun: true }, /action\.approval must be one of/],
    [{ connector: "crm-lite", capability: "contact.read", scopes: [], approval: "not-required" }, /action\.dryRun must be a boolean/],
    [{ connector: "crm-lite", capability: "contact.read", scopes: [], approval: "not-required", dryRun: "true" }, /action\.dryRun must be a boolean/]
  ];

  for (const [action, diagnostic] of cases) {
    const report = preflight(manifest, action);
    assert.equal(report.verdict, "blocked");
    assert.match(report.findings.join("\n"), diagnostic);
  }
});

test("preflight blocks incomplete and wrongly typed capability metadata", () => {
  const base = { name: "read", requiredScopes: [], requiresApproval: false, sideEffect: false };
  const cases = [
    [{ ...base, requiredScopes: undefined }, /capability\.requiredScopes must be an array/],
    [{ ...base, requiredScopes: "read" }, /capability\.requiredScopes must be an array/],
    [{ ...base, requiredScopes: [1] }, /capability\.requiredScopes must contain only non-empty strings/],
    [{ ...base, requiresApproval: undefined }, /capability\.requiresApproval must be a boolean/],
    [{ ...base, requiresApproval: "false" }, /capability\.requiresApproval must be a boolean/],
    [{ ...base, sideEffect: undefined }, /capability\.sideEffect must be a boolean/],
    [{ ...base, sideEffect: "false" }, /capability\.sideEffect must be a boolean/]
  ];

  for (const [capability, diagnostic] of cases) {
    const incompleteManifest = {
      connectors: [{ id: "demo", capabilities: [capability] }]
    };
    const report = preflight(incompleteManifest, {
      connector: "demo",
      capability: "read",
      scopes: [],
      approval: "not-required",
      dryRun: true
    });
    assert.equal(report.verdict, "blocked");
    assert.match(report.findings.join("\n"), diagnostic);
  }
});

test("empty scope arrays explicitly represent a valid zero-scope capability", () => {
  const zeroScopeManifest = {
    connectors: [{
      id: "demo",
      capabilities: [{
        name: "read",
        requiredScopes: [],
        requiresApproval: false,
        sideEffect: false
      }]
    }]
  };
  const report = preflight(zeroScopeManifest, {
    connector: "demo",
    capability: "read",
    scopes: [],
    approval: "not-required",
    dryRun: true
  });
  assert.equal(report.verdict, "pass");
  assert.deepEqual(report.findings, []);
});

test("CLI exits nonzero and reports malformed input deterministically", () => {
  const actionPath = join(tmpdir(), `connector-preflight-malformed-${process.pid}.json`);
  writeFileSync(actionPath, JSON.stringify({ connector: "crm-lite", capability: "contact.read" }));
  const run = spawnSync("node", ["bin/connector-preflight.js", "check", "fixtures/connectors.json", actionPath], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(run.status, 2);
  const report = JSON.parse(run.stdout);
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.findings, [
    "Invalid action: action.scopes must be an array of non-empty strings.",
    "Invalid action: action.approval must be one of: granted, missing, not-required.",
    "Invalid action: action.dryRun must be a boolean."
  ]);
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
