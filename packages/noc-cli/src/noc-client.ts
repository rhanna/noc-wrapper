#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { NocClient } from "@scope/noc-client";
import { parseArgs, printCliError, printHelp, printJson, readString } from "./cli-utils.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

interface CommandContext {
  readonly client: NocClient;
  readonly flags: Readonly<Record<string, string | boolean>>;
}

interface CommandSpec {
  readonly description: string;
  readonly run: (context: CommandContext) => Promise<unknown>;
}

const commands: Record<string, CommandSpec> = {
  auth: {
    description: "Authenticate and print the client authentication result.",
    run: async ({ client, flags }) =>
      client.authenticate(
        readString(flags, "username") ?? process.env.NOC_USERNAME ?? "",
        readString(flags, "password") ?? process.env.NOC_PASSWORD ?? "",
      ),
  },
};

export async function runNocClientCli(args: readonly string[]): Promise<void> {
  const cli = parseArgs(args);

  if (!cli.command || cli.flags.help === true || cli.flags.h === true) {
    printNocClientHelp();
    return;
  }

  const command = commands[cli.command];

  if (!command) {
    throw new Error(`Unknown command: ${cli.command}`);
  }

  const client = new NocClient({
    browserOptions: {
      baseUrl: readString(cli.flags, "base-url") ?? process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
    },
  });

  const result = await command.run({
    client,
    flags: cli.flags,
  });

  printJson(result);
}

function printNocClientHelp(): void {
  printHelp({
    executable: "noc-client",
    commands,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runNocClientCli(process.argv.slice(2)).catch((error: unknown) => {
    printCliError(error);
    process.exitCode = 1;
  });
}
