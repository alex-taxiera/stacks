#!/usr/bin/env node
import { addCommand } from "./commands/add.ts";
import { listCommand } from "./commands/list.ts";
import { newCommand } from "./commands/new.ts";
import { versionsCommand } from "./commands/versions.ts";
import { CLI_VERSION } from "./paths.ts";

const HELP = `stacks ${CLI_VERSION} — scaffold pnpm workspaces of Chakra UI apps

Usage:
  stacks new [dir] [options]        Make a new repo with its first app
  stacks add <stack> <name> [opts]  Add an app to the stacks repo you're in
  stacks list                       Stacks, deploy targets and add-ons
  stacks versions [refresh]         The known-good version snapshot

Run any command with --help for its options.
`;

const [command, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "new":
      await newCommand(rest);
      break;
    case "add":
      await addCommand(rest);
      break;
    case "list":
      listCommand();
      break;
    case "versions":
      await versionsCommand(rest);
      break;
    case "--version":
    case "-v":
      console.log(CLI_VERSION);
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command "${command}"\n\n${HELP}`);
      process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
