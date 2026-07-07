import fs from "node:fs";

const VERDICT_RANK = ["pass", "needs-approval", "missing-scope", "blocked"];

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const wrapped = new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    wrapped.code = "INVALID_JSON";
    throw wrapped;
  }
}

export function inspectConnectors(manifest) {
  const connectors = Array.isArray(manifest.connectors) ? manifest.connectors : [];
  return connectors.map((connector) => ({
    id: connector.id,
    name: connector.name || connector.id,
    capabilities: (connector.capabilities || []).map((capability) => capability.name),
    sideEffects: connector.sideEffects || []
  }));
}

export function preflight(manifest, action) {
  const findings = [];
  const connector = findConnector(manifest, action.connector);
  if (!connector) {
    return result("blocked", [`Unknown connector: ${action.connector || "missing"}`], action);
  }

  const capability = (connector.capabilities || []).find((entry) => entry.name === action.capability);
  if (!capability) {
    return result("blocked", [`Connector ${connector.id} does not expose capability ${action.capability || "missing"}.`], action, connector);
  }

  if (capability.blocked === true) {
    return result("blocked", [`Capability ${capability.name} is blocked by manifest policy.`], action, connector, capability);
  }

  const requestedScopes = new Set(Array.isArray(action.scopes) ? action.scopes : []);
  const missingScopes = (capability.requiredScopes || []).filter((scope) => !requestedScopes.has(scope));
  if (missingScopes.length > 0) {
    findings.push(`Missing scopes: ${missingScopes.join(", ")}`);
  }

  if (capability.requiresApproval && action.approval !== "granted") {
    findings.push(`Approval required for ${capability.name}.`);
  }

  if (capability.sideEffect && action.dryRun !== true && action.approval !== "granted") {
    findings.push("Live side effect requested without approval.");
  }

  const verdict = chooseVerdict({
    blocked: false,
    missingScopes,
    requiresApproval: capability.requiresApproval,
    approval: action.approval,
    sideEffect: capability.sideEffect,
    dryRun: action.dryRun
  });

  return result(verdict, findings, action, connector, capability);
}

export function renderMarkdown(report) {
  const lines = [
    `# Connector Preflight: ${report.action.connector || "unknown"}`,
    "",
    `- Capability: ${report.action.capability || "missing"}`,
    `- Verdict: ${report.verdict}`,
    `- Connector: ${report.connector?.name || report.connector?.id || "unknown"}`,
    `- Dry run: ${report.action.dryRun === true ? "yes" : "no"}`,
    "",
    "## Findings",
    ""
  ];

  if (report.findings.length === 0) {
    lines.push("- none");
  } else {
    for (const finding of report.findings) {
      lines.push(`- ${finding}`);
    }
  }

  lines.push("", "## Required Scopes", "");
  for (const scope of report.capability?.requiredScopes || []) {
    lines.push(`- ${scope}`);
  }
  if (!report.capability?.requiredScopes?.length) {
    lines.push("- none");
  }

  lines.push("", "## Stop Conditions", "");
  if (["blocked", "missing-scope"].includes(report.verdict)) {
    lines.push("- Do not execute this connector action.");
  } else if (report.verdict === "needs-approval") {
    lines.push("- Obtain explicit approval before execution.");
  } else {
    lines.push("- Local preflight checks passed.");
  }

  return `${lines.join("\n")}\n`;
}

export function exitCodeForVerdict(verdict) {
  return ["blocked", "missing-scope"].includes(verdict) ? 2 : 0;
}

function chooseVerdict({ missingScopes, requiresApproval, approval, sideEffect, dryRun }) {
  const candidates = ["pass"];
  if (missingScopes.length > 0) {
    candidates.push("missing-scope");
  }
  if (requiresApproval && approval !== "granted") {
    candidates.push("needs-approval");
  }
  if (sideEffect && dryRun !== true && approval !== "granted") {
    candidates.push("needs-approval");
  }
  return candidates.sort((a, b) => VERDICT_RANK.indexOf(b) - VERDICT_RANK.indexOf(a))[0];
}

function findConnector(manifest, id) {
  return (manifest.connectors || []).find((connector) => connector.id === id);
}

function result(verdict, findings, action, connector = null, capability = null) {
  return {
    verdict,
    findings,
    action,
    connector,
    capability
  };
}

