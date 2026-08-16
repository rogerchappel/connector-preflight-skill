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
  const manifestFindings = validateManifest(manifest);
  if (manifestFindings.length > 0) {
    throw new Error(manifestFindings.join("\n"));
  }

  const connectors = manifest.connectors;
  return connectors.map((connector) => ({
    id: connector.id,
    name: connector.name || connector.id,
    capabilities: (connector.capabilities || []).map((capability) => capability.name),
    sideEffects: connector.sideEffects || []
  }));
}

export function preflight(manifest, action) {
  const actionFindings = validateAction(action);
  if (actionFindings.length > 0) {
    return result("blocked", actionFindings, isRecord(action) ? action : {});
  }

  const manifestFindings = validateManifest(manifest);
  if (manifestFindings.length > 0) {
    return result("blocked", manifestFindings, action);
  }

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
  return verdict === "pass" ? 0 : 2;
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
  return (Array.isArray(manifest?.connectors) ? manifest.connectors : []).find((connector) => connector.id === id);
}

function validateAction(action) {
  if (!isRecord(action)) {
    return ["Invalid action: action must be a JSON object."];
  }

  const findings = [];
  validateNonEmptyString(action.connector, "action.connector", findings);
  validateNonEmptyString(action.capability, "action.capability", findings);
  validateStringArray(action.scopes, "action.scopes", findings);
  if (!["granted", "missing", "not-required"].includes(action.approval)) {
    findings.push("Invalid action: action.approval must be one of: granted, missing, not-required.");
  }
  if (typeof action.dryRun !== "boolean") {
    findings.push("Invalid action: action.dryRun must be a boolean.");
  }
  return findings;
}

function validateManifest(manifest) {
  if (!isRecord(manifest)) {
    return ["Invalid manifest: manifest must be a JSON object."];
  }
  if (!Array.isArray(manifest.connectors)) {
    return ["Invalid manifest: manifest.connectors must be an array."];
  }

  const findings = [];
  const connectorIds = new Map();
  for (const [connectorIndex, connector] of manifest.connectors.entries()) {
    const connectorPath = `manifest.connectors[${connectorIndex}]`;
    if (!isRecord(connector)) {
      findings.push(`Invalid manifest: ${connectorPath} must be a JSON object.`);
      continue;
    }
    validateManifestString(connector.id, `${connectorPath}.id`, findings);
    validateUniqueManifestString(connector.id, `${connectorPath}.id`, connectorIds, findings);
    if (connector.name !== undefined) {
      validateManifestString(connector.name, `${connectorPath}.name`, findings);
    }
    if (connector.sideEffects !== undefined) {
      validateOptionalManifestStringArray(connector.sideEffects, `${connectorPath}.sideEffects`, findings);
    }
    if (!Array.isArray(connector.capabilities)) {
      findings.push(`Invalid manifest: ${connectorPath}.capabilities must be an array.`);
      continue;
    }
    const capabilityNames = new Map();
    for (const [capabilityIndex, capability] of connector.capabilities.entries()) {
      const capabilityPath = `${connectorPath}.capabilities[${capabilityIndex}]`;
      if (!isRecord(capability)) {
        findings.push(`Invalid manifest: ${capabilityPath} must be a JSON object.`);
        continue;
      }
      validateManifestString(capability.name, `${capabilityPath}.name`, findings);
      validateUniqueManifestString(capability.name, `${capabilityPath}.name`, capabilityNames, findings);
      validateManifestStringArray(capability.requiredScopes, `${capabilityPath}.requiredScopes`, findings);
      for (const field of ["requiresApproval", "sideEffect"]) {
        if (typeof capability[field] !== "boolean") {
          findings.push(`Invalid manifest: ${capabilityPath}.${field} must be a boolean.`);
        }
      }
      if (capability.blocked !== undefined && typeof capability.blocked !== "boolean") {
        findings.push(`Invalid manifest: ${capabilityPath}.blocked must be a boolean when provided.`);
      }
    }
  }
  return findings;
}

function validateOptionalManifestStringArray(value, path, findings) {
  if (!Array.isArray(value)) {
    findings.push(`Invalid manifest: ${path} must be an array of non-empty strings when provided.`);
    return;
  }
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim() === "") {
      findings.push(`Invalid manifest: ${path}[${index}] must be a non-empty string.`);
    }
  }
}

function validateUniqueManifestString(value, path, seen, findings) {
  if (typeof value !== "string" || value.trim() === "") {
    return;
  }
  const firstPath = seen.get(value);
  if (firstPath) {
    findings.push(`Invalid manifest: ${path} duplicates ${firstPath} (${JSON.stringify(value)}).`);
  } else {
    seen.set(value, path);
  }
}

function validateManifestString(value, path, findings) {
  if (typeof value !== "string" || value.trim() === "") {
    findings.push(`Invalid manifest: ${path} must be a non-empty string.`);
  }
}

function validateManifestStringArray(value, path, findings) {
  if (!Array.isArray(value)) {
    findings.push(`Invalid manifest: ${path} must be an array of non-empty strings.`);
  } else if (value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    findings.push(`Invalid manifest: ${path} must contain only non-empty strings.`);
  }
}

function validateNonEmptyString(value, path, findings) {
  if (typeof value !== "string" || value.trim() === "") {
    findings.push(`Invalid action: ${path} must be a non-empty string.`);
  }
}

function validateStringArray(value, path, findings, subject = "action") {
  if (!Array.isArray(value)) {
    findings.push(`Invalid ${subject}: ${path} must be an array of non-empty strings.`);
  } else if (value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    findings.push(`Invalid ${subject}: ${path} must contain only non-empty strings.`);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
