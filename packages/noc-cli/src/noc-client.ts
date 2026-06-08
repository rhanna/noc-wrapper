#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { NocAuthenticationError } from "@rhanna/noc-browser";
import { NocClient } from "@scope/noc-client";
import type { CookieJar } from "tough-cookie";
import {
  parseArgs,
  printCliError,
  printHelp,
  printJson,
  readString,
  requireInteger,
  requireString,
} from "./cli-utils.js";
import {
  createNocClientSessionCookieJar,
  deleteNocClientSession,
  loadNocClientSession,
  saveNocClientSession,
} from "./noc-client-session.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";
const DEFAULT_REAUTH_ATTEMPTS = 3;

interface CommandContext {
  readonly client: NocClient;
  readonly flags: Readonly<Record<string, string | boolean>>;
}

interface CommandSpec {
  readonly description: string;
  readonly requiresAuth: boolean;
  readonly run: (context: CommandContext) => Promise<unknown>;
}

const commands: Record<string, CommandSpec> = {
  auth: {
    description: "Authenticate and print the client authentication result.",
    requiresAuth: false,
    run: async ({ client, flags }) =>
      client.authenticate(
        readString(flags, "username") ?? process.env.NOC_USERNAME ?? "",
        readString(flags, "password") ?? process.env.NOC_PASSWORD ?? "",
      ),
  },
  crew: {
    description: "Print crew identity JSON. Optional --employee-num or --name.",
    requiresAuth: true,
    run: async ({ client, flags }) => {
      const hasEmployeeNum = flags["employee-num"] !== undefined;
      const hasName = flags.name !== undefined;

      if (hasEmployeeNum && hasName) {
        throw new Error("crew accepts either --employee-num or --name, not both");
      }

      if (hasEmployeeNum) {
        const employeeNum = requireString(flags, "employee-num");
        return client.getCrewByEmployeeNum({ employeeNum });
      }

      if (hasName) {
        const name = requireString(flags, "name");
        return client.findCrewByName({ name });
      }

      return client.getCrew();
    },
  },
  "current-crew": {
    description: "Print current authenticated crew identity JSON.",
    requiresAuth: true,
    run: async ({ client }) => client.getCurrentCrew(),
  },
  logout: {
    description: "Delete the saved client session.",
    requiresAuth: false,
    run: async () => {
      throw new Error("logout is handled before client command execution");
    },
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

  const baseUrl = readString(cli.flags, "base-url") ?? process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL;

  if (cli.command === "logout") {
    printJson({
      loggedOut: await deleteNocClientSession(baseUrl),
    });
    return;
  }

  const result = await runCommand(command, cli.command, cli.flags, baseUrl);

  printJson(result);
}

async function runCommand(
  command: CommandSpec,
  commandName: string,
  flags: Readonly<Record<string, string | boolean>>,
  baseUrl: string,
): Promise<unknown> {
  if (commandName === "auth") {
    const cookieJar = createNocClientSessionCookieJar();
    const client = createClient(baseUrl, cookieJar);
    return runAuthCommand(command, client, flags, baseUrl, cookieJar);
  }

  if (command.requiresAuth) {
    return runAuthenticatedCommand(
      command,
      flags,
      baseUrl,
      await loadRequiredSessionCookieJar(baseUrl),
    );
  }

  const client = createClient(baseUrl, createNocClientSessionCookieJar());
  return command.run({
    client,
    flags,
  });
}

function createClient(baseUrl: string, cookieJar: CookieJar): NocClient {
  return new NocClient({
    browserOptions: {
      baseUrl,
      cookieJar,
    },
  });
}

async function runAuthCommand(
  command: CommandSpec,
  client: NocClient,
  flags: Readonly<Record<string, string | boolean>>,
  baseUrl: string,
  cookieJar: CookieJar,
): Promise<unknown> {
  const result = await command.run({
    client,
    flags,
  });

  await saveNocClientSession(baseUrl, cookieJar);
  return result;
}

async function runAuthenticatedCommand(
  command: CommandSpec,
  flags: Readonly<Record<string, string | boolean>>,
  baseUrl: string,
  initialCookieJar: CookieJar,
): Promise<unknown> {
  let cookieJar = initialCookieJar;
  let client = createClient(baseUrl, cookieJar);
  const reauthAttempts = readReauthAttempts(flags);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await command.run({
        client,
        flags,
      });
    } catch (error) {
      if (!isAuthenticationError(error)) {
        throw error;
      }

      if (attempt >= reauthAttempts) {
        throw new Error(
          `NOC session expired and re-authentication did not restore it after ${reauthAttempts} attempt(s). Run noc-client auth and try again.`,
        );
      }

      cookieJar = createNocClientSessionCookieJar();
      client = createClient(baseUrl, cookieJar);
      await authenticateWithAvailableCredentials(client, flags);
      await saveNocClientSession(baseUrl, cookieJar);
    }
  }
}

async function loadRequiredSessionCookieJar(baseUrl: string): Promise<CookieJar> {
  const session = await loadNocClientSession(baseUrl);

  if (!session) {
    throw new Error("No saved noc-client session found. Run noc-client auth first.");
  }

  return session.cookieJar;
}

async function authenticateWithAvailableCredentials(
  client: NocClient,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<void> {
  const username = readString(flags, "username") ?? process.env.NOC_USERNAME;
  const password = readString(flags, "password") ?? process.env.NOC_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "NOC session expired and re-authentication requires NOC_USERNAME and NOC_PASSWORD or --username and --password.",
    );
  }

  await client.authenticate(username, password);
}

function readReauthAttempts(flags: Readonly<Record<string, string | boolean>>): number {
  const attempts =
    readCliReauthAttempts(flags) ??
    readEnvironmentInteger("NOC_REAUTH_ATTEMPTS") ??
    DEFAULT_REAUTH_ATTEMPTS;

  if (attempts < 0) {
    throw new Error("Option --reauth-attempts must be greater than or equal to 0");
  }

  return attempts;
}

function readCliReauthAttempts(
  flags: Readonly<Record<string, string | boolean>>,
): number | undefined {
  return flags["reauth-attempts"] === undefined
    ? undefined
    : requireInteger(flags, "reauth-attempts");
}

function readEnvironmentInteger(name: string): number | undefined {
  const value = process.env[name];

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }

  return parsed;
}

function isAuthenticationError(error: unknown): boolean {
  return (
    error instanceof NocAuthenticationError || getErrorName(error) === "NocAuthenticationError"
  );
}

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function printNocClientHelp(): void {
  printHelp({
    executable: "noc-client",
    globalOptions: [
      "  --base-url <url>               Override NOC_BASE_URL.",
      "  --reauth-attempts <n>          Re-auth attempts after session expiry; default 3.",
      "  --username <username>          Credential source for auth or re-auth.",
      "  --password <password>          Credential source for auth or re-auth.",
    ],
    commands,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runNocClientCli(process.argv.slice(2)).catch((error: unknown) => {
    printCliError(error);
    process.exitCode = 1;
  });
}
