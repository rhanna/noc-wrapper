import { load } from "cheerio";
import { NocBrowserError, NocRevisionAckRequiredError } from "./errors.js";
import { REVISION_PATH } from "./lib/noc-url-utils.js";
import type { NocBrowser } from "./noc-browser.js";
import { NocBrowserPage } from "./noc-browser-page.js";
import { hasRevisionAckRequiredHtml, parseRevisionAckDetails } from "./noc-revision-ack.js";

const STATION_OPS_PATH = "/Dialogues/Operations/StationOperations.aspx";
const DATE_TEXT_FIELD = "ctl00$MasterMain$tbDate$DateFieldTextBox";
const DATE_HIDDEN_FIELD = "ctl00$MasterMain$tbDate$hfDate";
const STATION_FIELD = "ctl00$MasterMain$ddlStation";
const SORT_FIELD = "ctl00$MasterMain$ddlSort";
const TIME_MODE_FIELD = "ctl00$MasterMain$TimeMode$DP_TimeModes";
const SEARCH_FIELD = "ctl00$MasterMain$btnSearch";

type LoadedCheerio = ReturnType<typeof load>;
type CheerioAcceptedElement = Parameters<LoadedCheerio>[0];
type CheerioSelection = ReturnType<LoadedCheerio>;

export enum StationOpsSort {
  Time = 0,
  Station = 1,
}

export enum StationOpsTimeMode {
  UTC = 1,
  Local = 2,
}

export type StationOpsDateInput = Date | string;

export interface NocStationOpsOptions {
  readonly date: StationOpsDateInput;
  readonly stationId?: number;
  readonly stationCode?: string;
  readonly sort?: StationOpsSort;
  readonly timeMode?: StationOpsTimeMode;
  readonly refreshPage?: boolean;
}

export interface NocStationOpsResult {
  readonly departuresLabel?: string;
  readonly arrivalsLabel?: string;
  readonly departures: readonly NocStationOpsDeparture[];
  readonly arrivals: readonly NocStationOpsArrival[];
}

export interface NocStationOpsDeparture {
  readonly header: NocStationOpsDepartureHeader;
  readonly details: NocStationOpsDetails;
}

export interface NocStationOpsArrival {
  readonly header: NocStationOpsArrivalHeader;
  readonly details: NocStationOpsDetails;
}

export interface NocStationOpsDepartureHeader {
  readonly flightNum: string;
  readonly STD: string;
  readonly ATD: string;
  readonly dest: string;
  readonly registration: string;
  readonly gate: string;
  readonly pax: string;
  readonly color: string;
  readonly raw: readonly string[];
}

export interface NocStationOpsArrivalHeader {
  readonly flightNum: string;
  readonly STA: string;
  readonly ATA: string;
  readonly origin: string;
  readonly registration: string;
  readonly gate: string;
  readonly pax: string;
  readonly color: string;
  readonly raw: readonly string[];
}

export interface NocStationOpsDetails {
  readonly date?: string;
  readonly departure?: string;
  readonly arrival?: string;
  readonly STD?: string;
  readonly STA?: string;
  readonly registration?: string;
  readonly version?: string;
  readonly type?: string;
  readonly depGate?: string;
  readonly arrGate?: string;
  readonly crewOnBoard?: string;
  readonly delay?: string;
  readonly pax?: string;
  readonly notes?: string;
  readonly raw: readonly NocStationOpsDetailRow[];
}

export interface NocStationOpsDetailRow {
  readonly label: string;
  readonly value: string;
}

interface FormattedStationOpsDate {
  readonly dateText: string;
  readonly hiddenDate: string;
}

export class NocStationOpsPage extends NocBrowserPage {
  constructor(browser: NocBrowser) {
    super(browser, STATION_OPS_PATH);
  }

  async getStationOps(options: NocStationOpsOptions): Promise<NocStationOpsResult> {
    const normalizedOptions = validateStationOpsOptions(options);
    await this.load({ refresh: normalizedOptions.refreshPage });
    this.throwIfRevisionAckRequired();

    const stationValue = this.resolveStationValue(normalizedOptions);

    await this.post({
      [DATE_TEXT_FIELD]: normalizedOptions.date.dateText,
      [DATE_HIDDEN_FIELD]: normalizedOptions.date.hiddenDate,
      ...(stationValue === undefined ? {} : { [STATION_FIELD]: stationValue }),
      [SORT_FIELD]: String(normalizedOptions.sort),
      [TIME_MODE_FIELD]: String(normalizedOptions.timeMode),
      [SEARCH_FIELD]: "Search",
    });
    this.throwIfRevisionAckRequired();

    return this.parseResults();
  }

  private resolveStationValue(options: NormalizedStationOpsOptions): string | undefined {
    if (options.stationId !== undefined) {
      return String(options.stationId);
    }

    if (options.stationCode !== undefined) {
      return this.resolveStationCode(options.stationCode);
    }

    return undefined;
  }

  private resolveStationCode(stationCode: string): string {
    const $ = load(this.html);
    const normalizedCode = stationCode.trim().toUpperCase();

    for (const option of $(`select[name="${STATION_FIELD}"] option`).toArray()) {
      const $option = $(option);
      const optionText = normalizeText($option.text()).toUpperCase();

      if (optionText === normalizedCode || optionText.startsWith(`${normalizedCode} -`)) {
        return $option.attr("value") ?? $option.text();
      }
    }

    throw new NocBrowserError(`NOC Station Ops stationCode was not found: ${stationCode}`);
  }

  private parseResults(): NocStationOpsResult {
    const $ = load(this.html);

    return {
      departuresLabel: textOrUndefined($, "#MasterMain_lbUpper"),
      arrivalsLabel: textOrUndefined($, "#MasterMain_lbLower"),
      departures: parsePanel($, "#panelUpperWrapper", "departure"),
      arrivals: parsePanel($, "#panelLowerWrapper", "arrival"),
    };
  }

  private throwIfRevisionAckRequired(): void {
    if (hasRevisionAckRequiredHtml(this.html)) {
      throw new NocRevisionAckRequiredError(
        "NOC revision acknowledgement is required before completing the Station Ops request",
        parseRevisionAckDetails(this.html, this.browser.resolveUrl(REVISION_PATH)),
      );
    }
  }
}

interface NormalizedStationOpsOptions {
  readonly date: FormattedStationOpsDate;
  readonly stationId?: number;
  readonly stationCode?: string;
  readonly sort: StationOpsSort;
  readonly timeMode: StationOpsTimeMode;
  readonly refreshPage: boolean;
}

function validateStationOpsOptions(options: NocStationOpsOptions): NormalizedStationOpsOptions {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new NocBrowserError("NOC Station Ops options are required");
  }

  if (options.stationId !== undefined && options.stationCode !== undefined) {
    throw new NocBrowserError("NOC Station Ops accepts either stationId or stationCode, not both");
  }

  if (options.stationId !== undefined && !isPositiveInteger(options.stationId)) {
    throw new NocBrowserError("NOC Station Ops stationId must be a positive integer");
  }

  if (
    options.stationCode !== undefined &&
    (typeof options.stationCode !== "string" || options.stationCode.trim() === "")
  ) {
    throw new NocBrowserError("NOC Station Ops stationCode must be a non-empty string");
  }

  const sort = options.sort ?? StationOpsSort.Time;
  const timeMode = options.timeMode ?? StationOpsTimeMode.Local;

  if (!isStationOpsSort(sort)) {
    throw new NocBrowserError("NOC Station Ops sort is invalid");
  }

  if (!isStationOpsTimeMode(timeMode)) {
    throw new NocBrowserError("NOC Station Ops timeMode is invalid");
  }

  if (options.refreshPage !== undefined && typeof options.refreshPage !== "boolean") {
    throw new NocBrowserError("NOC Station Ops refreshPage must be a boolean");
  }

  return {
    date: formatStationOpsDate(options.date),
    stationId: options.stationId,
    stationCode: options.stationCode?.trim().toUpperCase(),
    sort,
    timeMode,
    refreshPage: options.refreshPage ?? false,
  };
}

function parsePanel(
  $: LoadedCheerio,
  selector: string,
  type: "departure",
): NocStationOpsDeparture[];
function parsePanel($: LoadedCheerio, selector: string, type: "arrival"): NocStationOpsArrival[];
function parsePanel(
  $: LoadedCheerio,
  selector: string,
  type: "departure" | "arrival",
): Array<NocStationOpsDeparture | NocStationOpsArrival> {
  const rows = $(selector).find(".ListItem").toArray();

  if (type === "departure") {
    return rows.map((item) => parseDepartureRow($, item));
  }

  return rows.map((item) => parseArrivalRow($, item));
}

function parseDepartureRow($: LoadedCheerio, item: CheerioAcceptedElement): NocStationOpsDeparture {
  const { rawHeader, color, details } = parseRowParts($, item);

  return {
    header: {
      flightNum: rawHeader[0] ?? "",
      STD: rawHeader[1] ?? "",
      ATD: rawHeader[2] ?? "",
      dest: rawHeader[3] ?? "",
      registration: rawHeader[4] ?? "",
      gate: rawHeader[5] ?? "",
      pax: rawHeader[7] ?? "",
      color,
      raw: rawHeader,
    },
    details,
  };
}

function parseArrivalRow($: LoadedCheerio, item: CheerioAcceptedElement): NocStationOpsArrival {
  const { rawHeader, color, details } = parseRowParts($, item);

  return {
    header: {
      flightNum: rawHeader[0] ?? "",
      STA: rawHeader[1] ?? "",
      ATA: rawHeader[2] ?? "",
      origin: rawHeader[3] ?? "",
      registration: rawHeader[4] ?? "",
      gate: rawHeader[5] ?? "",
      pax: rawHeader[7] ?? "",
      color,
      raw: rawHeader,
    },
    details,
  };
}

function parseRowParts(
  $: LoadedCheerio,
  item: CheerioAcceptedElement,
): {
  readonly rawHeader: readonly string[];
  readonly color: string;
  readonly details: NocStationOpsDetails;
} {
  const $item = $(item);
  const $header = $item.find(".ItemHeader").first();
  const rawHeader = $header
    .find(".ActivityInfoRow td")
    .toArray()
    .map((cell) => normalizeText($(cell).text()));
  const color = extractBackgroundColor($header.attr("style") ?? "");
  const details = parseDetails($, $item.find(".ItemChildTableDetails").first());

  return { rawHeader, color, details };
}

function parseDetails($: LoadedCheerio, detailsTable: CheerioSelection): NocStationOpsDetails {
  const values: Record<string, string> = {};
  const raw: NocStationOpsDetailRow[] = [];

  detailsTable.find("tr").each((_, row) => {
    const cells = $(row).find("td");

    if (cells.length < 2) {
      return;
    }

    const label = elementText($, cells[0]);
    const value = elementText($, cells[1]);

    if (!label) {
      return;
    }

    raw.push({ label, value });
    values[label] = value;
  });

  return {
    date: values.Date,
    departure: values.Departure,
    arrival: values.Arrival,
    STD: values.STD,
    STA: values.STA,
    registration: values.Registration,
    version: values.Version,
    type: values.Type,
    depGate: values["Dep Gate"],
    arrGate: values["Arr Gate"],
    crewOnBoard: values["Crew On Board"],
    delay: values.Delay,
    pax: values.Pax,
    notes: values.Notes,
    raw,
  };
}

function formatStationOpsDate(value: StationOpsDateInput): FormattedStationOpsDate {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new NocBrowserError("NOC Station Ops date is invalid");
    }

    return formatDateParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }

  if (typeof value !== "string") {
    throw new NocBrowserError("NOC Station Ops date is required");
  }

  const trimmed = value.trim().toUpperCase();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (isoMatch) {
    return formatDateParts(
      Number(isoMatch[1] ?? ""),
      Number(isoMatch[2] ?? ""),
      Number(isoMatch[3] ?? ""),
    );
  }

  const compactMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);

  if (compactMatch) {
    return formatDateParts(
      Number(compactMatch[1] ?? ""),
      Number(compactMatch[2] ?? ""),
      Number(compactMatch[3] ?? ""),
    );
  }

  const nocMatch = /^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})$/.exec(
    trimmed,
  );

  if (nocMatch) {
    const year = Number(nocMatch[3] ?? "");
    const fullYear = year <= 79 ? 2000 + year : 1900 + year;
    return formatDateParts(
      fullYear,
      monthNameToNumber(nocMatch[2] ?? ""),
      Number(nocMatch[1] ?? ""),
    );
  }

  throw new NocBrowserError("NOC Station Ops date must be Date, YYYY-MM-DD, YYYYMMDD, or DDMMMYY");
}

function formatDateParts(year: number, month: number, day: number): FormattedStationOpsDate {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new NocBrowserError("NOC Station Ops date is invalid");
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yy = String(year % 100).padStart(2, "0");

  return {
    dateText: `${dd}${MONTH_NAMES[month - 1]}${yy}`,
    hiddenDate: `${year}${mm}${dd}`,
  };
}

const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function monthNameToNumber(monthName: string): number {
  const index = MONTH_NAMES.indexOf(monthName as (typeof MONTH_NAMES)[number]);

  if (index < 0) {
    throw new NocBrowserError("NOC Station Ops date month is invalid");
  }

  return index + 1;
}

function extractBackgroundColor(style: string): string {
  const match = /background-color\s*:\s*([^;]+)/i.exec(style);
  return match?.[1]?.trim() ?? "";
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function elementText($: LoadedCheerio, element: CheerioAcceptedElement | undefined): string {
  if (element === undefined) {
    return "";
  }

  const $element = $(element);
  $element.find("br").replaceWith(" ");
  return normalizeText($element.text());
}

function textOrUndefined($: LoadedCheerio, selector: string): string | undefined {
  const text = normalizeText($(selector).first().text());
  return text || undefined;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isStationOpsSort(value: unknown): value is StationOpsSort {
  return value === StationOpsSort.Time || value === StationOpsSort.Station;
}

function isStationOpsTimeMode(value: unknown): value is StationOpsTimeMode {
  return value === StationOpsTimeMode.UTC || value === StationOpsTimeMode.Local;
}

export function getStationOps(
  page: NocStationOpsPage,
  options: NocStationOpsOptions,
): Promise<NocStationOpsResult> {
  return page.getStationOps(options);
}
