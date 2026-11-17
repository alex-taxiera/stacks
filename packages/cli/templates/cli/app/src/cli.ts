#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { greet } from "./greet.ts";

const { version } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf8"),
) as { version: string };

const HELP = `__BIN_NAME__ ${version}

Usage:
  __BIN_NAME__ hello [name] [--shout]   Greet someone (default: world)
  __BIN_NAME__ --version                 Print the version

Options:
  --shout       Greet in capitals
  -h, --help    Show this help
`;

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      shout: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (values.version) {
    console.log(version);
    return 0;
  }
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(HELP);
    return 0;
  }
  if (command === "hello") {
    console.log(greet(rest[0], { shout: values.shout }));
    return 0;
  }
  console.error(`Unknown command "${command}"\n\n${HELP}`);
  return 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
