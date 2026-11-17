#!/usr/bin/env node
import * as p from "@clack/prompts";

import { addCommand } from "./commands/add.ts";
import { listCommand } from "./commands/list.ts";
import { newCommand } from "./commands/new.ts";
import { updateCommand } from "./commands/update.ts";
import { versionsCommand } from "./commands/versions.ts";
import { CLI_VERSION } from "./paths.ts";
import { answer, intro, isInteractive } from "./prompts.ts";
import { findRoot } from "./scaffold.ts";

const HELP = `stacks ${CLI_VERSION} — scaffold pnpm workspaces of Chakra UI apps

Usage:
  stacks                            In a terminal, ask what to do
  stacks new [dir] [options]        Make a new repo with its first app
  stacks add [stack] [name] [opts]  Add an app to the stacks repo you're in
  stacks list                       Stacks, deploy targets and add-ons
  stacks update [--check]           Bring the AGENTS.md blocks and MCP servers up to date
  stacks versions [refresh]         The known-good version snapshot

new and add ask for anything not given when run in a terminal; pass --yes (or run them
elsewhere) to take the defaults. Run any command with --help for its options.
`;

/** Bare `stacks` in a terminal: pick a command, then answer its questions. */
async function menu() {
  intro(`stacks ${CLI_VERSION}`);
  const inRepo = findRoot(process.cwd()) !== undefined;
  const add = { value: "add", label: "Add an app to this repo", hint: "stacks add" };
  const create = { value: "new", label: "Make a new repo", hint: "stacks new" };
  const choice = answer(
    await p.select({
      message: "What do you want to do?",
      options: [
        ...(inRepo ? [add, create] : [create]),
        ...(inRepo
          ? [{ value: "update", label: "Update what stacks manages here", hint: "stacks update" }]
          : []),
        { value: "list", label: "List stacks, deploy targets and add-ons", hint: "stacks list" },
      ],
    }),
  );
  switch (choice) {
    case "add":
      return addCommand([]);
    case "new":
      return newCommand([]);
    case "update":
      return updateCommand([]);
    default:
      p.outro("Stacks, deploy targets and add-ons:");
      return listCommand();
  }
}

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
    case "update":
      await updateCommand(rest);
      break;
    case "versions":
      await versionsCommand(rest);
      break;
    case "--version":
    case "-v":
      console.log(CLI_VERSION);
      break;
    case undefined:
      if (isInteractive()) await menu();
      else console.log(HELP);
      break;
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
