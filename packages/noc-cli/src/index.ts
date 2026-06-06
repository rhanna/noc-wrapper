#!/usr/bin/env node

import { NocBrowser, StationOpsSort, StationOpsTimeMode } from "@rhanna/noc-browser";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

interface CliOptions {
  readonly command?: string;
  readonly flags: Readonly<Record<string, string | boolean>>;
}

interface CommandContext {
  readonly browser: NocBrowser;
  readonly flags: Readonly<Record<string, string | boolean>>;
}

interface CommandSpec {
  readonly description: string;
  readonly requiresAuth: boolean;
  readonly run: (context: CommandContext) => Promise<unknown>;
}

const commands: Record<string, CommandSpec> = {
  auth: {
    description: "Authenticate and print the raw authentication result.",
    requiresAuth: false,
    run: async ({ browser }) => authenticate(browser),
  },
  "current-user": {
    description: "Print GetCurrentUserInfo raw JSON.",
    requiresAuth: true,
    run: async ({ browser }) => browser.getCurrentUserInfo(),
  },
  "human-resources": {
    description: "Print GetHumanResources raw JSON.",
    requiresAuth: true,
    run: async ({ browser }) => browser.getHumanResources(),
  },
  roster: {
    description: "Print GetRoster raw JSON. Requires --month, --year, and --hr-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getRoster({
        month: requireInteger(flags, "month"),
        year: requireInteger(flags, "year"),
        hrId: requireInteger(flags, "hr-id"),
      }),
  },
  "roster-monthly-values": {
    description:
      "Print GetMonthlyAccumulatedValues raw JSON. Requires --month, --year, and --hr-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getRosterMonthlyAccumulatedValues({
        month: requireInteger(flags, "month"),
        year: requireInteger(flags, "year"),
        hrId: requireInteger(flags, "hr-id"),
      }),
  },
  "crew-on-board": {
    description: "Print GetCrewOnBoardDetails raw JSON. Requires --activity-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getCrewOnBoardDetails(requireInteger(flags, "activity-id")),
  },
  revision: {
    description: "Print the raw My Revision result.",
    requiresAuth: true,
    run: async ({ browser }) => browser.getRevision(),
  },
  "revision-status": {
    description: "Print whether revision acknowledgement is currently required.",
    requiresAuth: true,
    run: async ({ browser }) => ({
      revisionAckRequired: await browser.hasRevisionAckRequired(),
    }),
  },
  "confirm-revision": {
    description: "Confirm My Revision. Requires --confirm.",
    requiresAuth: true,
    run: async ({ browser, flags }) => {
      if (flags.confirm !== true) {
        throw new Error("confirm-revision requires --confirm");
      }

      return browser.confirmRevision();
    },
  },
  "open-time-user-context": {
    description: "Print open-time user-context raw JSON.",
    requiresAuth: true,
    run: async ({ browser }) => browser.getOpenTimeUserContext(),
  },
  "open-time-roster": {
    description: "Print open-time roster raw JSON. Requires --base-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getOpenTimeRoster({ baseId: requireInteger(flags, "base-id") }),
  },
  "open-time-roster-legality": {
    description: "Print open-time roster legality raw JSON. Requires --base-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getOpenTimeRosterLegalityValues({ baseId: requireInteger(flags, "base-id") }),
  },
  "open-time-pairings": {
    description: "Print open-time pairings raw JSON. Requires --base-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getOpenTimePairings({ baseId: requireInteger(flags, "base-id") }),
  },
  "open-time-pairings-legality": {
    description: "Print open-time pairings legality raw JSON. Requires --base-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getOpenTimePairingsLegalityValues({ baseId: requireInteger(flags, "base-id") }),
  },
  "open-time-pairing-block": {
    description: "Print open-time pairing block details raw JSON. Requires --pairing-id.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getOpenTimePairingsBlockDetails(requireInteger(flags, "pairing-id")),
  },
  "net-reserve": {
    description: "Print net reserve raw JSON. Optional --is-sap.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getNetReserve({
        isSap: readBoolean(flags, "is-sap") ?? false,
      }),
  },
  "station-ops": {
    description: "Print Station Ops raw JSON. Requires --date and --station-id or --station-code.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getStationOps({
        date: requireString(flags, "date"),
        stationId: readOptionalInteger(flags, "station-id"),
        stationCode: readOptionalString(flags, "station-code"),
        sort: readStationOpsSort(flags),
        timeMode: readStationOpsTimeMode(flags),
        refreshPage: readBoolean(flags, "refresh-page") ?? true,
      }),
  },
};

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));

  if (!cli.command || cli.flags.help === true || cli.flags.h === true) {
    printHelp();
    return;
  }

  const command = commands[cli.command];

  if (!command) {
    throw new Error(`Unknown command: ${cli.command}`);
  }

  const browser = new NocBrowser({
    baseUrl: readString(cli.flags, "base-url") ?? process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
  });

  if (command.requiresAuth) {
    await authenticate(browser, cli.flags);
  }

  const result = await command.run({
    browser,
    flags: cli.flags,
  });

  printJson(result);
}

async function authenticate(
  browser: NocBrowser,
  flags: Readonly<Record<string, string | boolean>> = {},
): Promise<unknown> {
  return browser.authenticate(
    readString(flags, "username") ?? process.env.NOC_USERNAME ?? "",
    readString(flags, "password") ?? process.env.NOC_PASSWORD ?? "",
  );
}

function parseArgs(args: readonly string[]): CliOptions {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("-")) {
      command ??= arg;
      continue;
    }

    const trimmed = arg.replace(/^-+/, "");
    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex >= 0) {
      flags[trimmed.slice(0, equalsIndex)] = trimmed.slice(equalsIndex + 1);
      continue;
    }

    const next = args[index + 1];

    if (next && !next.startsWith("-")) {
      flags[trimmed] = next;
      index += 1;
    } else {
      flags[trimmed] = true;
    }
  }

  return { command, flags };
}

function readString(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): string | undefined {
  const value = flags[name];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

function requireString(flags: Readonly<Record<string, string | boolean>>, name: string): string {
  const value = readString(flags, name);

  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }

  return value;
}

function readBoolean(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): boolean | undefined {
  const value = flags[name];

  if (value === undefined) {
    return undefined;
  }

  if (value === true) {
    return true;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  throw new Error(`Option --${name} must be true or false`);
}

function readOptionalString(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): string | undefined {
  return readString(flags, name);
}

function readOptionalInteger(
  flags: Readonly<Record<string, string | boolean>>,
  name: string,
): number | undefined {
  const value = readString(flags, name);
  return value === undefined ? undefined : parseInteger(value, name);
}

function requireInteger(flags: Readonly<Record<string, string | boolean>>, name: string): number {
  return parseInteger(requireString(flags, name), name);
}

function parseInteger(value: string, name: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Option --${name} must be an integer`);
  }

  return parsed;
}

function readStationOpsSort(
  flags: Readonly<Record<string, string | boolean>>,
): StationOpsSort | undefined {
  const value = readString(flags, "sort");

  if (value === undefined) {
    return undefined;
  }

  if (value === "time") {
    return StationOpsSort.Time;
  }

  if (value === "station") {
    return StationOpsSort.Station;
  }

  throw new Error("Option --sort must be time or station");
}

function readStationOpsTimeMode(
  flags: Readonly<Record<string, string | boolean>>,
): StationOpsTimeMode | undefined {
  const value = readString(flags, "time-mode");

  if (value === undefined) {
    return undefined;
  }

  if (value === "utc") {
    return StationOpsTimeMode.UTC;
  }

  if (value === "local") {
    return StationOpsTimeMode.Local;
  }

  throw new Error("Option --time-mode must be utc or local");
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`Usage: noc <command> [options]

Global options:
  --base-url <url>       Defaults to NOC_BASE_URL or ${DEFAULT_BASE_URL}
  --username <username>  Defaults to NOC_USERNAME
  --password <password>  Defaults to NOC_PASSWORD

Commands:
${Object.entries(commands)
  .map(([name, command]) => `  ${name.padEnd(29)} ${command.description}`)
  .join("\n")}
`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
