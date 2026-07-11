#!/usr/bin/env node

import { NocAuthenticationError } from "@rhanna/noc-browser";
import { htmlToPlainText, NocClient } from "@scope/noc-client";
import type {
  NocCrew,
  NocCrewListResult,
  NocRosterActivity,
  NocRosterCrewOnBoard,
  NocRosterDetailValue,
  NocRosterResult,
} from "@scope/noc-client";
import type { CookieJar } from "tough-cookie";
import {
  isDirectCliExecution,
  parseArgs,
  parseOutputFormat,
  printCliError,
  printFormatted,
  printHelp,
  readBoolean,
  readString,
  requireInteger,
  requireString,
  type OutputFormat,
} from "./cli-utils.js";
import {
  createNocClientSessionCookieJar,
  deleteNocClientSession,
  loadNocClientSession,
  saveNocClientSession,
} from "./noc-client-session.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";
const DEFAULT_REAUTH_ATTEMPTS = 3;

type CrewSortKey = "employee-num" | "name";

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
    description:
      "Print crew identity JSON. Optional --employee-num, --name text|/regex/flags, or --sort employee-num|name.",
    requiresAuth: true,
    run: async ({ client, flags }) => {
      const hasEmployeeNum = flags["employee-num"] !== undefined;
      const hasName = flags.name !== undefined;
      const sort = readCrewSortKey(flags);

      if (hasEmployeeNum && hasName) {
        throw new Error("crew accepts either --employee-num or --name, not both");
      }

      if (hasEmployeeNum) {
        const employeeNum = requireString(flags, "employee-num");
        return client.getCrewByEmployeeNum({ employeeNum });
      }

      if (hasName) {
        const name = requireString(flags, "name");
        return sortCrewListResult(await client.findCrewByName({ name }), sort);
      }

      return sortCrewListResult(await client.getCrew(), sort);
    },
  },
  "current-crew": {
    description: "Print current authenticated crew identity JSON.",
    requiresAuth: true,
    run: async ({ client }) => client.getCurrentCrew(),
  },
  roster: {
    description:
      "Print interpreted roster. Requires --month <n>, --year <yyyy>, and --employee-num <num> or --current-crew. Optional --show-crew for table output.",
    requiresAuth: true,
    run: async ({ client, flags }) => {
      const { month, year, employeeNum } = await readRosterCommandOptions(client, flags);
      return client.getRoster({ month, year, employeeNum });
    },
  },
  "roster-monthly-values": {
    description:
      "Print interpreted roster monthly values JSON. Requires --month <n>, --year <yyyy>, and --employee-num <num> or --current-crew.",
    requiresAuth: true,
    run: async ({ client, flags }) => {
      const { month, year, employeeNum } = await readRosterCommandOptions(client, flags);
      return client.getRosterMonthlyValues({ month, year, employeeNum });
    },
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
  const format = readOutputFormat(cli.flags);

  if (cli.command === "logout") {
    printFormatted(
      {
        loggedOut: await deleteNocClientSession(baseUrl),
      },
      format,
    );
    return;
  }

  const result = await runCommand(command, cli.command, cli.flags, baseUrl);

  if (cli.command === "roster" && format === "table") {
    console.log(formatRosterTable(result, readRosterShowCrew(cli.flags)));
    return;
  }

  printFormatted(result, format);
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

function readCrewSortKey(flags: Readonly<Record<string, string | boolean>>): CrewSortKey {
  if (flags.sort === undefined) {
    return "employee-num";
  }

  const sort = requireString(flags, "sort");

  if (sort === "employee-num" || sort === "name") {
    return sort;
  }

  throw new Error("Option --sort must be employee-num or name");
}

function sortCrewListResult(result: NocCrewListResult, sort: CrewSortKey): NocCrewListResult {
  return {
    crew: [...result.crew].sort((left, right) => compareCrew(left, right, sort)),
  };
}

async function readRosterCommandOptions(
  client: NocClient,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<{ readonly month: number; readonly year: number; readonly employeeNum: string }> {
  const month = requireInteger(flags, "month");
  const year = requireInteger(flags, "year");
  const employeeNum = await readRosterEmployeeNum(client, flags);

  return { month, year, employeeNum };
}

async function readRosterEmployeeNum(
  client: NocClient,
  flags: Readonly<Record<string, string | boolean>>,
): Promise<string> {
  const hasEmployeeNum = flags["employee-num"] !== undefined;
  const hasCurrentCrew = flags["current-crew"] !== undefined;

  if (hasEmployeeNum && hasCurrentCrew) {
    throw new Error("roster target accepts either --employee-num or --current-crew, not both");
  }

  if (hasEmployeeNum) {
    return requireString(flags, "employee-num");
  }

  if (hasCurrentCrew) {
    const result = await client.getCurrentCrew();
    return result.crew.employeeNum;
  }

  throw new Error("roster target requires --employee-num or --current-crew");
}

function compareCrew(left: NocCrew, right: NocCrew, sort: CrewSortKey): number {
  if (sort === "name") {
    return compareCrewName(left, right) || compareCrewEmployeeNum(left, right);
  }

  return compareCrewEmployeeNum(left, right) || compareCrewName(left, right);
}

function compareCrewEmployeeNum(left: NocCrew, right: NocCrew): number {
  return left.employeeNum.localeCompare(right.employeeNum, undefined, { numeric: true });
}

function compareCrewName(left: NocCrew, right: NocCrew): number {
  return left.displayName.localeCompare(right.displayName);
}

function formatRosterTable(value: unknown, showCrew: boolean): string {
  if (!isRosterResult(value)) {
    return "";
  }

  const activityDays = value.days.filter((day) => day.activities.length > 0);

  if (activityDays.length === 0) {
    return "";
  }

  const columns = ["Date", "Activity", "Dep", "Arr", "CI", "STD/ATD", "STA/ATA", "CO", "Info"];
  const rows = activityDays.flatMap((day) =>
    day.activities.map((activity) => rosterActivityRow(day.date, activity)),
  );
  const tableRows = [columns, ...rows];
  const widths = columns.map((_, index) =>
    Math.max(...tableRows.map((row) => row[index]?.length ?? 0)),
  );
  const renderRow = (row: readonly string[]) =>
    row
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join("  ")
      .trimEnd();
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  const lines = [renderRow(columns), separator];

  for (const [dayIndex, day] of activityDays.entries()) {
    if (dayIndex > 0) {
      lines.push("");
    }

    for (const activity of day.activities) {
      lines.push(renderRow(rosterActivityRow(day.date, activity)));

      if (showCrew) {
        lines.push(...formatCrewLines(activity.details.crewOnBoard, widths[0] ?? 0));
      }
    }
  }

  return lines.join("\n");
}

function readRosterShowCrew(flags: Readonly<Record<string, string | boolean>>): boolean {
  return readBoolean(flags, "show-crew") === true;
}

function rosterActivityRow(date: string, activity: NocRosterActivity): readonly string[] {
  return [
    date,
    activity.activity,
    formatLocation(activity.dep, activity.details.departure ?? activity.details.station),
    formatLocation(activity.arr, activity.details.arrival),
    activity.checkIn ?? activity.details.checkIn ?? "",
    formatScheduledActual(activity.std, activity.atd),
    formatScheduledActual(activity.sta, activity.ata),
    activity.checkOut ?? activity.details.checkOut ?? "",
    formatRosterInfo(activity),
  ];
}

function formatScheduledActual(scheduled: string | undefined, actual: string | undefined): string {
  if (scheduled && actual && scheduled !== actual) {
    return `${scheduled}/${actual}`;
  }

  return actual ?? scheduled ?? "";
}

function formatLocation(
  value: string | undefined,
  detail: NocRosterDetailValue | undefined,
): string {
  return value ?? formatDetailValue(detail);
}

function formatDetailValue(value: NocRosterDetailValue | undefined): string {
  const detailValue = value?.Value?.trim();

  if (!detailValue) {
    return "";
  }

  return detailValue.split(" - ")[0]?.trim() ?? detailValue;
}

function formatRosterInfo(activity: NocRosterActivity): string {
  const info = firstNonEmpty([
    activity.info,
    activity.details.activity,
    activity.details.rosterLegalException,
    activity.details.hotel,
    activity.details.generalNote,
    activity.details.comment,
    activity.details.rosterDesignators,
    activity.details.othersWhoHaveTheSameActivity,
  ]);

  return info === undefined ? "" : htmlToPlainText(info);
}

function firstNonEmpty(values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0);
}

function formatCrewLines(
  crew: readonly NocRosterCrewOnBoard[] | undefined,
  dateColumnWidth: number,
): readonly string[] {
  return crew?.map((member) => `${" ".repeat(dateColumnWidth)}  ${formatCrewMember(member)}`) ?? [];
}

function formatCrewMember(member: NocRosterCrewOnBoard): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
  const designators =
    member.designators.length > 0 ? ` (${member.designators.join(", ")})` : "";

  return [member.position, member.employeeNum, name].filter(Boolean).join(" ") + designators;
}

function isRosterResult(value: unknown): value is NocRosterResult {
  return (
    isPlainObject(value) &&
    typeof value.employeeNum === "string" &&
    typeof value.date === "string" &&
    Array.isArray(value.days) &&
    Array.isArray(value.rosterNotes)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function readOutputFormat(flags: Readonly<Record<string, string | boolean>>): OutputFormat {
  const cliFormat = readString(flags, "format");

  if (cliFormat !== undefined) {
    return parseOutputFormat(cliFormat, "Option --format");
  }

  const envFormat = process.env.NOC_CLIENT_FORMAT;

  if (envFormat) {
    return parseOutputFormat(envFormat, "NOC_CLIENT_FORMAT");
  }

  return "table";
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
      "  --format <json|table|csv>      Defaults to NOC_CLIENT_FORMAT or table.",
      "  --reauth-attempts <n>          Re-auth attempts after session expiry; default 3.",
      "  --username <username>          Credential source for auth or re-auth.",
      "  --password <password>          Credential source for auth or re-auth.",
    ],
    commands,
  });
}

if (isDirectCliExecution(import.meta.url)) {
  runNocClientCli(process.argv.slice(2)).catch((error: unknown) => {
    printCliError(error);
    process.exitCode = 1;
  });
}
