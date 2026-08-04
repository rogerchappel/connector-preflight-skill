#!/usr/bin/env node
import { exitCodeForVerdict, inspectConnectors, preflight, readJson, renderMarkdown } from "../src/index.js";

const argv = process.argv.slice(2);
const [command] = argv;

if (command === "--version") {
  requireExactArguments(argv, 1, "--version does not accept arguments.");
  const packageJson = readJson(new URL("../package.json", import.meta.url));
  process.stdout.write(`${packageJson.version}\n`);
  process.exit(0);
}

if (["-h", "--help"].includes(command)) {
  requireExactArguments(argv, 1, `${command} does not accept arguments.`);
  printHelp();
  process.exit(0);
}

try {
  const { manifestPath, actionPath, format } = parseArguments(argv);
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

function parseArguments(args) {
  const [command, manifestPath, actionPath, ...options] = args;
  if (!command) {
    throw new Error("Missing command. Run connector-preflight --help for usage.");
  }
  if (!manifestPath) {
    throw new Error(`Missing connector manifest path for ${command}.`);
  }
  if (command === "inspect") {
    if (actionPath !== undefined) {
      throw new Error(`inspect does not accept extra arguments: ${[actionPath, ...options].join(" ")}`);
    }
    return { manifestPath };
  }
  if (command !== "check") {
    throw new Error(`Unknown command: ${command}`);
  }
  if (!actionPath) {
    throw new Error("Missing action request path.");
  }

  let format = "json";
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option !== "--format") {
      throw new Error(option.startsWith("-") ? `Unknown option: ${option}` : `Unexpected positional argument: ${option}`);
    }
    if (format !== "json" || options.slice(0, index).includes("--format")) {
      throw new Error("Option --format may only be specified once.");
    }
    const value = options[index + 1];
    if (value === undefined || value.startsWith("-")) {
      throw new Error("Option --format requires a value: markdown or json.");
    }
    if (!["markdown", "json"].includes(value)) {
      throw new Error(`Unsupported format: ${value}`);
    }
    format = value;
    index += 1;
  }
  return { manifestPath, actionPath, format };
}

function requireExactArguments(args, count, message) {
  if (args.length !== count) {
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

function printHelp() {
  process.stdout.write(`connector-preflight

Usage:
  connector-preflight inspect <connectors.json>
  connector-preflight check <connectors.json> <action.json> [--format markdown|json]
`);
}
