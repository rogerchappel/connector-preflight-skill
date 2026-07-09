#!/usr/bin/env node
import { exitCodeForVerdict, inspectConnectors, preflight, readJson, renderMarkdown } from "../src/index.js";

const [command, manifestPath, actionPath, ...args] = process.argv.slice(2);

if (command === "--version") {
  const packageJson = readJson(new URL("../package.json", import.meta.url));
  process.stdout.write(`${packageJson.version}\n`);
  process.exit(0);
}

if (!command || !manifestPath || ["-h", "--help"].includes(command)) {
  printHelp();
  process.exit(command ? 0 : 1);
}

try {
  const manifest = readJson(manifestPath);
  if (command === "inspect") {
    process.stdout.write(`${JSON.stringify(inspectConnectors(manifest), null, 2)}\n`);
    process.exit(0);
  }
  if (command === "check") {
    if (!actionPath) {
      throw new Error("Missing action request path.");
    }
    const action = readJson(actionPath);
    const report = preflight(manifest, action);
    const format = readOption(args, "--format") || "json";
    if (format === "markdown") {
      process.stdout.write(renderMarkdown(report));
    } else if (format === "json") {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
    process.exit(exitCodeForVerdict(report.verdict));
  }
  throw new Error(`Unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp() {
  process.stdout.write(`connector-preflight

Usage:
  connector-preflight inspect <connectors.json>
  connector-preflight check <connectors.json> <action.json> --format markdown|json
`);
}
