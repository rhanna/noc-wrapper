#!/usr/bin/env node

import {
  NocAuthenticationError,
  NocBrowser,
  StationOpsSort,
  StationOpsTimeMode,
} from "@rhanna/noc-browser";
import type { CookieJar } from "tough-cookie";
import {
  isDirectCliExecution,
  parseArgs,
  printCliError,
  printHelp,
  printJson,
  readBoolean,
  readOptionalInteger,
  readOptionalString,
  readString,
  requireInteger,
  requireString,
} from "./cli-utils.js";
import {
  createNocBrowserSessionCookieJar,
  deleteNocBrowserSession,
  loadNocBrowserSession,
  saveNocBrowserSession,
} from "./noc-browser-session.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";
const DEFAULT_REAUTH_ATTEMPTS = 3;

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
    run: async ({ browser, flags }) => authenticate(browser, flags),
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
    description:
      "Print GetRoster raw JSON. Requires --month, --year, and --hr-id or --employee-num.",
    requiresAuth: true,
    run: async ({ browser, flags }) =>
      browser.getRoster({
        month: requireInteger(flags, "month"),
        year: requireInteger(flags, "year"),
        hrId: await readRosterHrId(browser, flags),
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
  logout: {
    description: "Delete the saved browser session.",
    requiresAuth: false,
    run: async () => {
      throw new Error("logout is handled before browser command execution");
    },
  },
};

export async function runNocBrowserCli(args: readonly string[]): Promise<void> {
  const cli = parseArgs(args);

  if (!cli.command || cli.flags.help === true || cli.flags.h === true) {
    printNocBrowserHelp();
    return;
  }

  const command = commands[cli.command];

  if (!command) {
    throw new Error(`Unknown command: ${cli.command}`);
  }

  const baseUrl = readString(cli.flags, "base-url") ?? process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL;

  if (cli.command === "logout") {
    printJson({
      loggedOut: await deleteNocBrowserSession(baseUrl),
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
    const cookieJar = createNocBrowserSessionCookieJar();
    const browser = createBrowser(baseUrl, cookieJar);
    return runAuthCommand(command, browser, flags, baseUrl, cookieJar);
  }

  if (command.requiresAuth) {
    return runAuthenticatedCommand(
      command,
      flags,
      baseUrl,
      await loadRequiredSessionCookieJar(baseUrl),
    );
  }

  return command.run({
    browser: createBrowser(baseUrl, createNocBrowserSessionCookieJar()),
    flags,
  });
}

function createBrowser(baseUrl: string, cookieJar: CookieJar): NocBrowser {
  return new NocBrowser({
    baseUrl,
    cookieJar,
  });
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

async function runAuthCommand(
  command: CommandSpec,
  browser: NocBrowser,
  flags: Readonly<Record<string, string | boolean>>,
  baseUrl: string,
  cookieJar: CookieJar,
): Promise<unknown> {
  const result = await command.run({
    browser,
    flags,
  });

  await saveNocBrowserSession(baseUrl, cookieJar);
  return result;
}

async function runAuthenticatedCommand(
  command: CommandSpec,
  flags: Readonly<Record<string, string | boolean>>,
  baseUrl: string,
  initialCookieJar: CookieJar,
): Promise<unknown> {
  let cookieJar = initialCookieJar;
  let browser = createBrowser(baseUrl, cookieJar);
  const reauthAttempts = readReauthAttempts(flags);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await command.run({
        browser,
        flags,
      });
    } catch (error) {
      if (!isAuthenticationError(error)) {
        throw error;
      }

      if (attempt >= reauthAttempts) {
        throw new Error(
          `NOC session expired and re-authentication did not restore it after ${reauthAttempts} attempt(s). Run noc-browser auth and try again.`,
        );
      }

      cookieJar = createNocBrowserSessionCookieJar();
      browser = createBrowser(baseUrl, cookieJar);
      await authenticateWithAvailableCredentials(browser, flags);
      await saveNocBrowserSession(baseUrl, cookieJar);
    }
  }
}

async function loadRequiredSessionCookieJar(baseUrl: string): Promise<CookieJar> {
  const session = await loadNocBrowserSession(baseUrl);

  if (!session) {
    throw new Error("No saved noc-browser session found. Run noc-browser auth first.");
  }

  return session.cookieJar;
}

async function authenticateWithAvailableCredentials(
  browser: NocBrowser,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<void> {
  const username = readString(flags, "username") ?? process.env.NOC_USERNAME;
  const password = readString(flags, "password") ?? process.env.NOC_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "NOC session expired and re-authentication requires NOC_USERNAME and NOC_PASSWORD or --username and --password.",
    );
  }

  await browser.authenticate(username, password);
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

async function readRosterHrId(
  browser: NocBrowser,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<number> {
  const hrId = readOptionalInteger(flags, "hr-id");
  const employeeNum = readOptionalString(flags, "employee-num");

  if (hrId !== undefined && employeeNum !== undefined) {
    throw new Error("roster accepts either --hr-id or --employee-num, not both");
  }

  if (employeeNum !== undefined) {
    return resolveHrIdByEmployeeNum(browser, employeeNum);
  }

  if (hrId !== undefined) {
    return hrId;
  }

  throw new Error("Missing required option --hr-id or --employee-num");
}

async function resolveHrIdByEmployeeNum(browser: NocBrowser, employeeNum: string): Promise<number> {
  const normalizedEmployeeNum = normalizeEmployeeNum(employeeNum);
  const humanResources = await browser.getHumanResources();
  const resources = readHumanResources(humanResources);
  const matches = resources.filter(
    (resource) => readEmployeeNum(resource) === normalizedEmployeeNum,
  );

  if (matches.length === 0) {
    throw new Error(`No HumanResources row found for employee number: ${employeeNum}`);
  }

  if (matches.length > 1) {
    throw new Error(`Multiple HumanResources rows found for employee number: ${employeeNum}`);
  }

  const hrId = matches[0]?.Id;

  if (typeof hrId !== "number" || !Number.isInteger(hrId) || hrId < 1) {
    throw new Error(`HumanResources row for employee number ${employeeNum} has no valid Id`);
  }

  return hrId;
}

interface HumanResourceRow {
  readonly Id?: unknown;
  readonly DisplayName?: unknown;
  readonly EmpNo?: unknown;
  readonly EmployeeNum?: unknown;
  readonly EmployeeNumber?: unknown;
  readonly [key: string]: unknown;
}

function readHumanResources(value: unknown): HumanResourceRow[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("GetHumanResources returned an invalid response");
  }

  const resources = (value as { readonly HumanResources?: unknown }).HumanResources;

  if (!Array.isArray(resources)) {
    throw new Error("GetHumanResources response is missing HumanResources");
  }

  return resources.filter(isHumanResourceRow);
}

function isHumanResourceRow(value: unknown): value is HumanResourceRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEmployeeNum(resource: HumanResourceRow): string | undefined {
  for (const field of ["EmpNo", "EmployeeNum", "EmployeeNumber"]) {
    const value = resource[field];

    if (typeof value === "string" || typeof value === "number") {
      return normalizeEmployeeNumCandidate(String(value));
    }
  }

  if (typeof resource.DisplayName !== "string") {
    return undefined;
  }

  const match = /^\s*(\d+)\b/.exec(resource.DisplayName);
  return match ? normalizeEmployeeNumCandidate(match[1] ?? "") : undefined;
}

function normalizeEmployeeNum(value: string): string {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error("Option --employee-num must contain only digits");
  }

  return normalized;
}

function normalizeEmployeeNumCandidate(value: string): string | undefined {
  const normalized = value.trim();
  return /^\d+$/.test(normalized) ? normalized : undefined;
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

function printNocBrowserHelp(): void {
  printHelp({
    executable: "noc-browser",
    globalOptions: [
      `  --base-url <url>       Defaults to NOC_BASE_URL or ${DEFAULT_BASE_URL}`,
      "  --reauth-attempts <n>  Re-auth attempts after session expiry; default 3.",
      "  --username <username>  Defaults to NOC_USERNAME",
      "  --password <password>  Defaults to NOC_PASSWORD",
    ],
    commands,
  });
}

if (isDirectCliExecution(import.meta.url)) {
  runNocBrowserCli(process.argv.slice(2)).catch((error: unknown) => {
    printCliError(error);
    process.exitCode = 1;
  });
}
