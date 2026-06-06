#!/usr/bin/env node

import { parseArgs, printCliError, printHelp } from "./cli-utils.js";

const commands: Record<string, { readonly description: string }> = {};

export async function runNocClientCli(args: readonly string[]): Promise<void> {
  const cli = parseArgs(args);

  if (!cli.command || cli.flags.help === true || cli.flags.h === true) {
    printNocClientHelp();
    return;
  }

  throw new Error(`Unknown command: ${cli.command}`);
}

function printNocClientHelp(): void {
  printHelp({
    executable: "noc-client",
    commands,
  });
}

runNocClientCli(process.argv.slice(2)).catch((error: unknown) => {
  printCliError(error);
  process.exitCode = 1;
});
