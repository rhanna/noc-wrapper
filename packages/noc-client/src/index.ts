import { NocBrowser } from "@rhanna/noc-browser";
import type { NocBrowserOptions } from "@rhanna/noc-browser";

export type NocClientOptions =
  | { readonly browser: NocBrowser; readonly browserOptions?: never }
  | { readonly browser?: never; readonly browserOptions: NocBrowserOptions };

export interface NocClientAuthResult {
  readonly authenticated: true;
  readonly revisionAckRequired: boolean;
}

export interface NocCrew {
  readonly employeeNum: string;
  readonly displayName: string;
}

export interface NocCurrentCrewResult {
  readonly crew: NocCrew;
}

export interface NocCrewListResult {
  readonly crew: readonly NocCrew[];
}

export interface NocCrewLookupOptions {
  readonly employeeNum: string;
}

export interface NocCrewLookupResult {
  readonly crew: NocCrew;
}

export interface NocCrewNameSearchOptions {
  readonly name: string;
}

type NocCrewNameSearch =
  | { readonly type: "text"; readonly name: string }
  | { readonly type: "regex"; readonly pattern: RegExp };

export class NocClient {
  readonly #browser: NocBrowser;

  constructor(options: NocClientOptions) {
    if (!isObject(options)) {
      throw new TypeError("NocClient requires exactly one of browser or browserOptions");
    }

    const hasBrowser = "browser" in options && options.browser !== undefined;
    const hasBrowserOptions = "browserOptions" in options && options.browserOptions !== undefined;

    if (hasBrowser === hasBrowserOptions) {
      throw new TypeError("NocClient requires exactly one of browser or browserOptions");
    }

    this.#browser = hasBrowser ? options.browser : new NocBrowser(options.browserOptions);
  }

  async authenticate(username: string, password: string): Promise<NocClientAuthResult> {
    const result = await this.#browser.authenticate(username, password);

    return {
      authenticated: result.authenticated,
      revisionAckRequired: result.revisionAckRequired,
    };
  }

  async getCrew(): Promise<NocCrewListResult> {
    const result = await this.#browser.getHumanResources();
    return { crew: readHumanResources(result).map(toNocCrew) };
  }

  async getCurrentCrew(): Promise<NocCurrentCrewResult> {
    const currentUserResult = await this.#browser.getCurrentUserInfo();
    const employeeNum = readRequiredEmployeeNum(readCurrentUser(currentUserResult));
    const humanResourcesResult = await this.#browser.getHumanResources();
    const match = readOnlyCrewMatch(
      readHumanResources(humanResourcesResult).filter(
        (row) => readEmployeeNum(row) === employeeNum,
      ),
      employeeNum,
    );

    readPrivateHrId(match, employeeNum);

    return { crew: toNocCrew(match) };
  }

  async getCrewByEmployeeNum(options: NocCrewLookupOptions): Promise<NocCrewLookupResult> {
    const employeeNum = normalizeEmployeeNum(options?.employeeNum);
    const result = await this.#browser.getHumanResources();
    const matches = readHumanResources(result).filter(
      (row) => readEmployeeNum(row) === employeeNum,
    );

    if (matches.length === 0) {
      throw new Error(`No crew row found for employee number: ${employeeNum}`);
    }

    if (matches.length > 1) {
      throw new Error(`Multiple crew rows found for employee number: ${employeeNum}`);
    }

    const match = readOnlyCrewMatch(matches, employeeNum);
    readPrivateHrId(match, employeeNum);

    return { crew: toNocCrew(match) };
  }

  async findCrewByName(options: NocCrewNameSearchOptions): Promise<NocCrewListResult> {
    const search = readNameSearch(options?.name);
    const result = await this.#browser.getHumanResources();
    const crew = readHumanResources(result)
      .map(toNocCrew)
      .filter((member) => matchesCrewNameSearch(member, search));

    return { crew };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface NocCrewRaw {
  readonly Id?: unknown;
  readonly DisplayName?: unknown;
  readonly [key: string]: unknown;
}

function readHumanResources(value: unknown): NocCrewRaw[] {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error("GetHumanResources returned an invalid response");
  }

  const resources = value.HumanResources;

  if (!Array.isArray(resources)) {
    throw new Error("GetHumanResources response is missing HumanResources");
  }

  return resources.map((resource, index) => readCrewRow(resource, `HumanResources[${index}]`));
}

function readCurrentUser(value: unknown): NocCrewRaw {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error("GetCurrentUserInfo returned an invalid response");
  }

  const info = value.Info;

  if (!isObject(info) || Array.isArray(info)) {
    throw new Error("GetCurrentUserInfo response is missing Info");
  }

  return readCrewRow(info.CurrentUser, "Info.CurrentUser");
}

function readCrewRow(value: unknown, path: string): NocCrewRaw {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error(`${path} is not a valid crew row`);
  }

  return value;
}

function toNocCrew(row: NocCrewRaw): NocCrew {
  const rawDisplayName = readDisplayName(row);
  const parsed = parseDisplayName(rawDisplayName);

  if (!parsed) {
    throw new Error(
      `Crew row display name does not start with an employee number: ${rawDisplayName}`,
    );
  }

  return {
    employeeNum: parsed.employeeNum,
    displayName: parsed.displayName,
  };
}

function readDisplayName(row: NocCrewRaw): string {
  const displayName = row.DisplayName;

  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    throw new Error("Crew row is missing DisplayName");
  }

  return normalizeWhitespace(displayName);
}

function readEmployeeNum(row: NocCrewRaw): string | undefined {
  return parseDisplayName(readDisplayName(row))?.employeeNum;
}

function readRequiredEmployeeNum(row: NocCrewRaw): string {
  const employeeNum = readEmployeeNum(row);

  if (employeeNum) {
    return employeeNum;
  }

  const displayName = readDisplayName(row);

  if (/^\d+$/.test(displayName)) {
    return displayName;
  }

  throw new Error(`Crew row display name does not start with an employee number: ${displayName}`);
}

function normalizeEmployeeNum(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("employeeNum is required");
  }

  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error("employeeNum must contain only digits");
  }

  return normalized;
}

function readNameSearch(value: unknown): NocCrewNameSearch {
  if (typeof value !== "string") {
    throw new Error("name is required");
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("/")) {
    return readRegexNameSearch(trimmed);
  }

  const normalized = normalizeWhitespace(value).toLocaleLowerCase();

  if (normalized.length === 0) {
    throw new Error("name is required");
  }

  return { type: "text", name: normalized };
}

function readRegexNameSearch(value: string): NocCrewNameSearch {
  if (value === "/" || value === "//") {
    throw new Error("name regex pattern is required");
  }

  const closingSlashIndex = value.lastIndexOf("/");

  if (closingSlashIndex === 0) {
    throw new Error("name regex must use /pattern/flags");
  }

  const pattern = value.slice(1, closingSlashIndex);
  const flags = value.slice(closingSlashIndex + 1);

  if (pattern.length === 0) {
    throw new Error("name regex pattern is required");
  }

  try {
    return { type: "regex", pattern: new RegExp(pattern, flags) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid name regex: ${message}`);
  }
}

function matchesCrewNameSearch(crew: NocCrew, search: NocCrewNameSearch): boolean {
  if (search.type === "regex") {
    return search.pattern.test(crew.displayName);
  }

  return readSearchableCrewName(crew).includes(search.name);
}

function readSearchableCrewName(crew: NocCrew): string {
  return crew.displayName.toLocaleLowerCase();
}

function parseDisplayName(
  displayName: string,
): { readonly employeeNum: string; readonly displayName: string } | undefined {
  const match = /^(\d+)\s+(.+)$/.exec(displayName);

  if (!match) {
    return undefined;
  }

  const employeeNum = match[1];
  const name = match[2];

  if (!employeeNum || !name) {
    return undefined;
  }

  return {
    employeeNum,
    displayName: name,
  };
}

function readPrivateHrId(row: NocCrewRaw | undefined, employeeNum: string): number {
  const hrId = row?.Id;

  if (typeof hrId !== "number" || !Number.isInteger(hrId) || hrId < 1) {
    throw new Error(`Crew row for employee number ${employeeNum} has no valid private Id`);
  }

  return hrId;
}

function readOnlyCrewMatch(matches: readonly NocCrewRaw[], employeeNum: string): NocCrewRaw {
  const match = matches[0];

  if (!match) {
    throw new Error(`No crew row found for employee number: ${employeeNum}`);
  }

  return match;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default NocClient;
