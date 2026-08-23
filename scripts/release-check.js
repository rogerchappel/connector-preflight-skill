import { execFileSync } from "node:child_process";

const commands = [
  ["npm", ["run", "check"]],
  ["npm", ["test"]],
  ["npm", ["run", "smoke"]],
  ["npm", ["run", "package:smoke"]]
];

if (process.env.CONNECTOR_PREFLIGHT_QUICKSTART_NESTED !== "1") {
  commands.push(["npm", ["run", "docs:smoke"]]);
}

for (const [command, args] of commands) {
  execFileSync(command, args, { stdio: "inherit" });
}
