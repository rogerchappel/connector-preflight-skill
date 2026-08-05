import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { exitCodeForVerdict, inspectConnectors, preflight, renderMarkdown } from "../src/index.js";

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

test("inspect rejects malformed manifest shapes before traversal", () => {
  const cases = [
    [{}, /manifest\.connectors must be an array/],
    [{ connectors: [null] }, /manifest\.connectors\[0\] must be a JSON object/],
    [{ connectors: [{ id: "", capabilities: [] }] }, /manifest\.connectors\[0\]\.id must be a non-empty string/],
    [{ connectors: [{ id: "demo", capabilities: {} }] }, /manifest\.connectors\[0\]\.capabilities must be an array/],
    [{ connectors: [{ id: "demo", capabilities: [null] }] }, /manifest\.connectors\[0\]\.capabilities\[0\] must be a JSON object/],
    [{ connectors: [{ id: "demo", capabilities: [{}] }] }, /manifest\.connectors\[0\]\.capabilities\[0\]\.name must be a non-empty string/]
  ];

  for (const [malformedManifest, diagnostic] of cases) {
    assert.throws(() => inspectConnectors(malformedManifest), diagnostic);
  }
});

test("manifest validation reports every malformed capability policy field in index order", () => {
  const malformedManifest = {
    connectors: [{
      id: "demo",
      capabilities: [
        { name: "valid", requiredScopes: [], requiresApproval: false, sideEffect: false },
        { name: "broken", requiredScopes: "read", requiresApproval: "yes", sideEffect: null, blocked: "no" }
      ]
    }]
  };

  assert.throws(
    () => inspectConnectors(malformedManifest),
    (error) => {
      assert.deepEqual(error.message.split("\n"), [
        "Invalid manifest: manifest.connectors[0].capabilities[1].requiredScopes must be an array of non-empty strings.",
        "Invalid manifest: manifest.connectors[0].capabilities[1].requiresApproval must be a boolean.",
        "Invalid manifest: manifest.connectors[0].capabilities[1].sideEffect must be a boolean.",
        "Invalid manifest: manifest.connectors[0].capabilities[1].blocked must be a boolean when provided."
      ]);
      return true;
    }
  );
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

test("every verdict has an automation-safe exit code", () => {
  assert.deepEqual(
    Object.fromEntries(["pass", "needs-approval", "missing-scope", "blocked"].map((verdict) => [
      verdict,
      exitCodeForVerdict(verdict)
    ])),
    {
      pass: 0,
      "needs-approval": 2,
      "missing-scope": 2,
      blocked: 2
    }
  );
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

test("preflight blocks incomplete and wrongly typed capability metadata with indexed paths", () => {
  const base = { name: "read", requiredScopes: [], requiresApproval: false, sideEffect: false };
  const cases = [
    [{ ...base, requiredScopes: undefined }, /capabilities\[0\]\.requiredScopes must be an array/],
    [{ ...base, requiredScopes: "read" }, /capabilities\[0\]\.requiredScopes must be an array/],
    [{ ...base, requiredScopes: [1] }, /capabilities\[0\]\.requiredScopes must contain only non-empty strings/],
    [{ ...base, requiresApproval: undefined }, /capabilities\[0\]\.requiresApproval must be a boolean/],
    [{ ...base, requiresApproval: "false" }, /capabilities\[0\]\.requiresApproval must be a boolean/],
    [{ ...base, sideEffect: undefined }, /capabilities\[0\]\.sideEffect must be a boolean/],
    [{ ...base, sideEffect: "false" }, /capabilities\[0\]\.sideEffect must be a boolean/],
    [{ ...base, blocked: "false" }, /capabilities\[0\]\.blocked must be a boolean when provided/]
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

test("preflight validates unselected capabilities before connector lookup", () => {
  const malformedManifest = {
    connectors: [{
      id: "demo",
      capabilities: [
        { name: "read", requiredScopes: [], requiresApproval: false, sideEffect: false },
        { name: "write", requiredScopes: [], requiresApproval: "yes", sideEffect: true }
      ]
    }]
  };
  const report = preflight(malformedManifest, {
    connector: "absent",
    capability: "other",
    scopes: [],
    approval: "not-required",
    dryRun: true
  });

  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.findings, [
    "Invalid manifest: manifest.connectors[0].capabilities[1].requiresApproval must be a boolean."
  ]);
});

test("preflight blocks malformed manifest shapes before traversal", () => {
  const action = {
    connector: "demo",
    capability: "read",
    scopes: [],
    approval: "not-required",
    dryRun: true
  };
  const cases = [
    [{}, /manifest\.connectors must be an array/],
    [{ connectors: [false] }, /manifest\.connectors\[0\] must be a JSON object/],
    [{ connectors: [{ capabilities: [] }] }, /manifest\.connectors\[0\]\.id must be a non-empty string/],
    [{ connectors: [{ id: "demo", capabilities: {} }] }, /manifest\.connectors\[0\]\.capabilities must be an array/],
    [{ connectors: [{ id: "demo", capabilities: ["read"] }] }, /manifest\.connectors\[0\]\.capabilities\[0\] must be a JSON object/]
  ];

  for (const [malformedManifest, diagnostic] of cases) {
    const report = preflight(malformedManifest, action);
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

test("CLI inspect exits nonzero with clear malformed-manifest diagnostics", () => {
  const manifestPath = join(tmpdir(), `connector-preflight-manifest-${process.pid}.json`);
  writeFileSync(manifestPath, JSON.stringify({ connectors: [{ id: "demo", capabilities: {} }] }));
  const run = spawnSync("node", ["bin/connector-preflight.js", "inspect", manifestPath], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(run.status, 1);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /manifest\.connectors\[0\]\.capabilities must be an array/);
  assert.doesNotMatch(run.stderr, /TypeError/);
});

test("CLI check exits 2 with a blocked malformed-manifest report", () => {
  const manifestPath = join(tmpdir(), `connector-preflight-manifest-check-${process.pid}.json`);
  writeFileSync(manifestPath, JSON.stringify({}));
  const run = spawnSync("node", [
    "bin/connector-preflight.js",
    "check",
    manifestPath,
    "fixtures/action.pass.json"
  ], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(run.status, 2);
  const report = JSON.parse(run.stdout);
  assert.equal(report.verdict, "blocked");
  assert.deepEqual(report.findings, ["Invalid manifest: manifest.connectors must be an array."]);
  assert.equal(run.stderr, "");
});

test("CLI inspect and check reject an unselected malformed capability", () => {
  const manifestPath = join(tmpdir(), `connector-preflight-policy-${process.pid}.json`);
  writeFileSync(manifestPath, JSON.stringify({
    connectors: [{
      id: "demo",
      capabilities: [
        { name: "read", requiredScopes: [], requiresApproval: false, sideEffect: false },
        { name: "write", requiredScopes: "write", requiresApproval: false, sideEffect: true }
      ]
    }]
  }));

  const inspectRun = spawnSync("node", ["bin/connector-preflight.js", "inspect", manifestPath], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(inspectRun.status, 1);
  assert.equal(inspectRun.stdout, "");
  assert.match(inspectRun.stderr, /capabilities\[1\]\.requiredScopes must be an array/);

  const checkRun = spawnSync("node", [
    "bin/connector-preflight.js",
    "check",
    manifestPath,
    "fixtures/action.pass.json"
  ], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
  assert.equal(checkRun.status, 2);
  assert.equal(checkRun.stderr, "");
  assert.deepEqual(JSON.parse(checkRun.stdout).findings, [
    "Invalid manifest: manifest.connectors[0].capabilities[1].requiredScopes must be an array of non-empty strings."
  ]);
});

test("CLI check exit status matches every verdict", () => {
  const cases = [
    ["action.pass.json", "pass", 0],
    ["action.needs-approval.json", "needs-approval", 2],
    ["action.missing-scope.json", "missing-scope", 2],
    ["action.blocked.json", "blocked", 2]
  ];

  for (const [fixtureName, verdict, status] of cases) {
    const run = spawnSync("node", [
      "bin/connector-preflight.js",
      "check",
      "fixtures/connectors.json",
      `fixtures/${fixtureName}`,
      "--format",
      "json"
    ], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });
    assert.equal(run.status, status, `${verdict} should exit ${status}: ${run.stderr}`);
    assert.equal(JSON.parse(run.stdout).verdict, verdict);
    assert.equal(run.stderr, "");
  }
});

test("CLI accepts check with the default format and each explicit format", () => {
  for (const formatArgs of [[], ["--format", "json"], ["--format", "markdown"]]) {
    const run = runCli("check", "fixtures/connectors.json", "fixtures/action.pass.json", ...formatArgs);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stderr, "");
    assert.notEqual(run.stdout, "");
  }
});

test("CLI rejects invalid argument forms without emitting a report", () => {
  const cases = [
    [["inspect", "fixtures/connectors.json", "unexpected.json"], /inspect does not accept extra arguments/],
    [["inspect", "fixtures/connectors.json", "--format", "json"], /inspect does not accept extra arguments/],
    [["check", "fixtures/connectors.json", "fixtures/action.pass.json", "extra.json"], /Unexpected positional argument: extra\.json/],
    [["check", "fixtures/connectors.json", "fixtures/action.pass.json", "--formt", "markdown"], /Unknown option: --formt/],
    [["check", "fixtures/connectors.json", "fixtures/action.pass.json", "--format"], /--format requires a value/],
    [["check", "fixtures/connectors.json", "fixtures/action.pass.json", "--format", "--help"], /--format requires a value/],
    [["check", "fixtures/connectors.json", "fixtures/action.pass.json", "--format", "json", "--format", "markdown"], /--format may only be specified once/]
  ];

  for (const [args, diagnostic] of cases) {
    const run = runCli(...args);
    assert.equal(run.status, 1, `${args.join(" ")}: ${run.stderr}`);
    assert.equal(run.stdout, "");
    assert.match(run.stderr, diagnostic);
  }
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

function runCli(...args) {
  return spawnSync("node", ["bin/connector-preflight.js", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  });
}
