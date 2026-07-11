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

export interface NocRosterOptions {
  readonly month: number;
  readonly year: number;
  readonly employeeNum: string;
}

export interface NocRosterResult {
  readonly employeeNum: string;
  readonly date: string;
  readonly crew?: NocCrew;
  readonly days: readonly NocRosterDay[];
  readonly rosterNotes: readonly unknown[];
}

export interface NocRosterDay {
  readonly date: string;
  readonly dayNumber: number;
  readonly color?: string;
  readonly departureInfo?: NocRosterDayInfo;
  readonly arrivalInfo?: NocRosterDayInfo;
  readonly hotelInfo?: NocRosterDayInfo;
  readonly activities: readonly NocRosterActivity[];
  readonly notes: readonly unknown[];
}

export interface NocRosterDayInfo {
  readonly info?: string;
  readonly details?: string;
  readonly color?: string;
}

export interface NocRosterActivity {
  readonly id: number;
  readonly activity: string;
  readonly checkIn?: string;
  readonly std?: string;
  readonly atd?: string;
  readonly dep?: string;
  readonly arr?: string;
  readonly sta?: string;
  readonly ata?: string;
  readonly checkOut?: string;
  readonly info?: string;
  readonly details: NocRosterActivityDetail;
}

export interface NocRosterActivityDetail {
  readonly activity?: string;
  readonly station?: NocRosterDetailValue;
  readonly departure?: NocRosterDetailValue;
  readonly arrival?: NocRosterDetailValue;
  readonly checkIn?: string;
  readonly start?: string;
  readonly end?: string;
  readonly checkOut?: string;
  readonly aircraftReg?: string;
  readonly version?: string;
  readonly type?: string;
  readonly crewOnBoard?: readonly NocRosterCrewOnBoard[];
  readonly rosterLegalException?: string;
  readonly hotel?: string;
  readonly reservationNo?: string;
  readonly comment?: string;
  readonly pickupToHotel?: string;
  readonly pickupFromHotel?: string;
  readonly generalNote?: string;
  readonly rosterDesignators?: string;
  readonly othersWhoHaveTheSameActivity?: string;
  readonly [label: string]: unknown;
}

export interface NocRosterCrewOnBoard {
  readonly employeeNum: string;
  readonly position: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email?: string;
  readonly designators: readonly string[];
}

export interface NocRosterDetailValue {
  readonly Id?: string;
  readonly Label?: string | null;
  readonly Value?: string;
  readonly Color?: string | null;
  readonly Values?: readonly unknown[];
}

export interface NocRosterMonthlyValuesResult {
  readonly employeeNum: string;
  readonly crew?: NocCrew;
  readonly values: readonly NocRosterMonthlyValue[];
}

export interface NocRosterMonthlyValue {
  readonly label: string;
  readonly value: string;
}

export function htmlToPlainText(value: string): string {
  return decodeHtmlEntities(stripHtml(value)).replace(/\s+/g, " ").trim();
}

type NocCrewNameSearch =
  | { readonly type: "text"; readonly name: string }
  | { readonly type: "regex"; readonly pattern: RegExp };

export class NocClient {
  readonly #browser: NocBrowser;
  readonly #hrIdByEmployeeNum = new Map<string, number>();
  readonly #crewByEmployeeNum = new Map<string, NocCrew>();

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

  async getRoster(options: NocRosterOptions): Promise<NocRosterResult> {
    const rosterOptions = readRosterOptions(options);
    const resolved = await this.resolveRosterCrew(rosterOptions.employeeNum);
    const result = await this.#browser.getRoster({
      month: rosterOptions.month,
      year: rosterOptions.year,
      hrId: resolved.hrId,
    });

    return mapRosterResult(result, rosterOptions.employeeNum, resolved.crew);
  }

  async getRosterMonthlyValues(options: NocRosterOptions): Promise<NocRosterMonthlyValuesResult> {
    const rosterOptions = readRosterOptions(options);
    const resolved = await this.resolveRosterCrew(rosterOptions.employeeNum);
    const result = await this.#browser.getRosterMonthlyAccumulatedValues({
      month: rosterOptions.month,
      year: rosterOptions.year,
      hrId: resolved.hrId,
    });

    return mapRosterMonthlyValuesResult(result, rosterOptions.employeeNum, resolved.crew);
  }

  private async resolveRosterCrew(
    employeeNum: string,
  ): Promise<{ readonly hrId: number; readonly crew?: NocCrew }> {
    const cachedHrId = this.#hrIdByEmployeeNum.get(employeeNum);

    if (cachedHrId !== undefined) {
      return {
        hrId: cachedHrId,
        crew: this.#crewByEmployeeNum.get(employeeNum),
      };
    }

    const rows = readHumanResources(await this.#browser.getHumanResources());
    this.populateHrIdCache(rows);
    const match = readOnlyResolvedCrewMatch(
      rows.filter((row) => readEmployeeNum(row) === employeeNum),
      employeeNum,
    );
    const hrId = readPrivateHrId(match, employeeNum);
    const crew = toNocCrew(match);

    this.#hrIdByEmployeeNum.set(employeeNum, hrId);
    this.#crewByEmployeeNum.set(employeeNum, crew);

    return { hrId, crew };
  }

  private populateHrIdCache(rows: readonly NocCrewRaw[]): void {
    const employeeNumCounts = new Map<string, number>();

    for (const row of rows) {
      const employeeNum = readEmployeeNum(row);

      if (employeeNum) {
        employeeNumCounts.set(employeeNum, (employeeNumCounts.get(employeeNum) ?? 0) + 1);
      }
    }

    for (const row of rows) {
      const employeeNum = readEmployeeNum(row);

      if (!employeeNum || employeeNumCounts.get(employeeNum) !== 1) {
        continue;
      }

      const hrId = row.Id;

      if (typeof hrId === "number" && Number.isInteger(hrId) && hrId > 0) {
        this.#hrIdByEmployeeNum.set(employeeNum, hrId);
        this.#crewByEmployeeNum.set(employeeNum, toNocCrew(row));
      }
    }
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

function readRosterOptions(options: NocRosterOptions): NocRosterOptions {
  if (!isObject(options) || Array.isArray(options)) {
    throw new Error("roster options are required");
  }

  if (!Number.isInteger(options.month) || options.month < 1 || options.month > 12) {
    throw new Error("month must be an integer from 1 to 12");
  }

  if (!Number.isInteger(options.year) || options.year < 1) {
    throw new Error("year must be a positive integer");
  }

  return {
    month: options.month,
    year: options.year,
    employeeNum: normalizeEmployeeNum(options.employeeNum),
  };
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

function readOnlyResolvedCrewMatch(
  matches: readonly NocCrewRaw[],
  employeeNum: string,
): NocCrewRaw {
  const match = readOnlyCrewMatch(matches, employeeNum);

  if (matches.length > 1) {
    throw new Error(`Multiple crew rows found for employee number: ${employeeNum}`);
  }

  return match;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function mapRosterResult(value: unknown, employeeNum: string, crew?: NocCrew): NocRosterResult {
  const root = unwrapWebMethodResult(value);
  const roster = readObject(root.Roster, "GetRoster response Roster");

  return withOptionalCrew(
    {
      employeeNum,
      date: readDateString(root.Date, "GetRoster response Date"),
      days: mapRosterDays(roster.Days),
      rosterNotes: readUnknownArray(roster.RosterNotes),
    },
    crew,
  );
}

function mapRosterMonthlyValuesResult(
  value: unknown,
  employeeNum: string,
  crew?: NocCrew,
): NocRosterMonthlyValuesResult {
  const root = unwrapWebMethodResult(value);

  return withOptionalCrew(
    {
      employeeNum,
      values: readUnknownArray(root.AccumulatedValues).map((item, index) =>
        mapRosterMonthlyValue(item, index),
      ),
    },
    crew,
  );
}

function withOptionalCrew<T extends { readonly employeeNum: string }>(
  result: T,
  crew: NocCrew | undefined,
): T & { readonly crew?: NocCrew } {
  return crew === undefined ? result : { ...result, crew };
}

function unwrapWebMethodResult(value: unknown): Record<string, unknown> {
  const root = readObject(value, "NOC response");

  if ("d" in root) {
    return readObject(root.d, "NOC response d");
  }

  return root;
}

function mapRosterMonthlyValue(value: unknown, index: number): NocRosterMonthlyValue {
  const item = readObject(value, `AccumulatedValues[${index}]`);
  const label = readRequiredString(item.Label, `AccumulatedValues[${index}].Label`);
  const monthlyValue = readRequiredString(item.Value, `AccumulatedValues[${index}].Value`);

  return {
    label,
    value: monthlyValue,
  };
}

function mapRosterDays(value: unknown): readonly NocRosterDay[] {
  const days = readObject(value, "Roster.Days");

  return Object.entries(days)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, day]) => mapRosterDay(date, day));
}

function mapRosterDay(date: string, value: unknown): NocRosterDay {
  const day = readObject(value, `Roster.Days.${date}`);
  const header = readObject(day.Header, `Roster.Days.${date}.Header`);
  const details = readOptionalObject(day.Details);

  return {
    date: normalizeRosterDate(date),
    dayNumber: readRequiredNumber(header.DayNumber, `Roster.Days.${date}.Header.DayNumber`),
    ...optionalStringProperty("color", readOptionalStringValue(header.Color ?? header.DayColor)),
    ...optionalDayInfoProperty("departureInfo", header.DepInfo),
    ...optionalDayInfoProperty("arrivalInfo", header.ArrInfo),
    ...optionalDayInfoProperty("hotelInfo", header.HotelInfo),
    activities: readUnknownArray(details?.ActivityDetails).map((activity, index) =>
      mapRosterActivity(activity, `${date}.ActivityDetails[${index}]`),
    ),
    notes: readUnknownArray(day.Notes),
  };
}

function mapRosterActivity(value: unknown, path: string): NocRosterActivity {
  const activity = readObject(value, path);

  return {
    id: readRequiredNumber(activity.Id, `${path}.Id`),
    activity: readRequiredString(activity.Activity, `${path}.Activity`),
    ...optionalStringProperty("checkIn", readOptionalStringValue(activity.CheckIn)),
    ...optionalStringProperty("std", readOptionalStringValue(activity.STD)),
    ...optionalStringProperty("atd", readOptionalStringValue(activity.ATD)),
    ...optionalStringProperty("dep", readOptionalStringValue(activity.Dep)),
    ...optionalStringProperty("arr", readOptionalStringValue(activity.Arr)),
    ...optionalStringProperty("sta", readOptionalStringValue(activity.STA)),
    ...optionalStringProperty("ata", readOptionalStringValue(activity.ATA)),
    ...optionalStringProperty("checkOut", readOptionalStringValue(activity.CheckOut)),
    ...optionalStringProperty("info", readOptionalStringValue(activity.Info)),
    details: mapRosterActivityDetails(activity.Details),
  };
}

function mapRosterActivityDetails(value: unknown): NocRosterActivityDetail {
  const result: Record<string, unknown> = {};

  for (const [index, rawDetail] of readUnknownArray(value).entries()) {
    const detail = readObject(rawDetail, `Activity.Details[${index}]`);
    const label = readRequiredString(detail.Label, `Activity.Details[${index}].Label`);
    const key = rosterDetailKey(label);

    result[key] =
      key === "crewOnBoard"
        ? parseCrewOnBoard(readOptionalStringValue(detail.Value) ?? "")
        : detail.Value;
  }

  return result as NocRosterActivityDetail;
}

function optionalDayInfoProperty(
  key: "departureInfo" | "arrivalInfo" | "hotelInfo",
  value: unknown,
): Partial<Pick<NocRosterDay, typeof key>> {
  const info = mapRosterDayInfo(value);
  return info === undefined ? {} : { [key]: info };
}

function mapRosterDayInfo(value: unknown): NocRosterDayInfo | undefined {
  const info = readOptionalObject(value);

  if (!info) {
    return undefined;
  }

  const mapped = {
    ...optionalStringProperty("info", readOptionalStringValue(info.Info)),
    ...optionalStringProperty("details", readOptionalStringValue(info.Details)),
    ...optionalStringProperty("color", readOptionalStringValue(info.Color)),
  };

  return Object.keys(mapped).length === 0 ? undefined : mapped;
}

function rosterDetailKey(label: string): string {
  const known: Record<string, string> = {
    "Aircraft Reg": "aircraftReg",
    CheckIn: "checkIn",
    CheckOut: "checkOut",
    "Crew On Board": "crewOnBoard",
    "General Note": "generalNote",
    "Others Who Have The Same Activity": "othersWhoHaveTheSameActivity",
    "Others Who Have the Same Activity": "othersWhoHaveTheSameActivity",
    "Pickup From Hotel": "pickupFromHotel",
    "Pickup To Hotel": "pickupToHotel",
    ReservationNo: "reservationNo",
    "Roster Designators": "rosterDesignators",
    "Roster Legal Exception": "rosterLegalException",
  };

  return known[label] ?? labelToCamelCase(label);
}

function labelToCamelCase(label: string): string {
  const words = label.match(/[A-Za-z0-9]+/g) ?? [];

  if (words.length === 0) {
    return label;
  }

  const [first, ...rest] = words;

  if (!first) {
    return label;
  }

  return [
    first.toLocaleLowerCase(),
    ...rest.map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1)),
  ].join("");
}

function parseCrewOnBoard(value: string): readonly NocRosterCrewOnBoard[] {
  return value
    .split(/<br\s*\/?>/i)
    .map((entry) => parseCrewOnBoardEntry(entry))
    .filter((entry): entry is NocRosterCrewOnBoard => entry !== undefined);
}

function parseCrewOnBoardEntry(value: string): NocRosterCrewOnBoard | undefined {
  const email = /mailto:([^"'>\s]+)/i.exec(value)?.[1];
  const text = htmlToPlainText(value);

  if (text.length === 0) {
    return undefined;
  }

  const match =
    /^([A-Z0-9]+)\s+-\s+(\d+)\s+(.+?)(?:\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}))?$/.exec(
      text,
    );

  if (!match) {
    return undefined;
  }

  const [, position, employeeNum, rawName, textEmail] = match;

  if (!position || !employeeNum || !rawName) {
    return undefined;
  }

  const designatorMatches = [...rawName.matchAll(/\(([^)]+)\)/g)];
  const designators = designatorMatches.flatMap((designator) =>
    (designator[1] ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const name = normalizeWhitespace(rawName.replace(/\s*\([^)]+\)/g, ""));
  const commaIndex = name.indexOf(",");
  const lastName = commaIndex >= 0 ? normalizeWhitespace(name.slice(0, commaIndex)) : "";
  const firstName =
    commaIndex >= 0 ? normalizeWhitespace(name.slice(commaIndex + 1)) : normalizeWhitespace(name);

  return {
    employeeNum,
    position,
    firstName,
    lastName,
    ...(email || textEmail ? { email: email ?? textEmail } : {}),
    designators,
  };
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function normalizeRosterDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value;
}

function readDateString(value: unknown, path: string): string {
  return normalizeRosterDate(readRequiredString(value, path));
}

function readRequiredString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }

  return value;
}

function readOptionalStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readRequiredNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a number`);
  }

  return value;
}

function readObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value;
}

function readOptionalObject(value: unknown): Record<string, unknown> | undefined {
  return isObject(value) && !Array.isArray(value) ? value : undefined;
}

function readUnknownArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function optionalStringProperty<K extends string>(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, string>>);
}

export default NocClient;
