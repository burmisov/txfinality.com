#!/usr/bin/env node
// `npx txfinality …` lands here. The runner is TypeScript; Node 22.6+ runs it directly
// once types are stripped, so this file only re-launches node with that switch on.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const major = Number(process.versions.node.split(".")[0]);
const minor = Number(process.versions.node.split(".")[1]);
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(`txfinality needs Node 22.6 or newer; this is ${process.versions.node}`);
  process.exit(1);
}

const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", cli, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
