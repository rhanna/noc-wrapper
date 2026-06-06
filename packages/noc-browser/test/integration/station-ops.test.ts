import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { NocBrowser, StationOpsSort, StationOpsTimeMode } from "../../src/index.js";
import { NocStationOpsPage } from "../../src/noc-station-ops.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

describe("Station Ops integration", () => {
  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "fetches Station Ops using cached and refreshed page state",
    async () => {
      const browser = new NocBrowser({
        baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
      });

      const authResult = await browser.authenticate(
        process.env.NOC_USERNAME ?? "",
        process.env.NOC_PASSWORD ?? "",
      );

      if (authResult.revisionAckRequired) {
        expect(authResult.revisionAckDetails?.confirmButtonPresent).toBe(true);
        return;
      }

      const date = new Date();
      const stationCode = process.env.NOC_STATION_OPS_STATION_CODE ?? "YTZ";
      const stationOps = await browser.getStationOps({
        date,
        stationCode,
        sort: StationOpsSort.Time,
        timeMode: StationOpsTimeMode.Local,
      });
      expectStationOpsContract(stationOps);

      const cachedStationOps = await browser.getStationOps({
        date,
        stationCode,
        sort: StationOpsSort.Time,
        timeMode: StationOpsTimeMode.Local,
      });
      expectStationOpsContract(cachedStationOps);

      const refreshedStationOps = await browser.getStationOps({
        date,
        stationCode,
        sort: StationOpsSort.Time,
        timeMode: StationOpsTimeMode.Local,
        refreshPage: true,
      });
      expectStationOpsContract(refreshedStationOps);

      const sanityPage = new NocStationOpsPage(browser);
      const liveStationOps = await sanityPage.getStationOps({
        date,
        stationCode,
        sort: StationOpsSort.Time,
        timeMode: StationOpsTimeMode.Local,
      });
      expectStationOpsHeaderSanity(liveStationOps, sanityPage.html);
    },
    90000,
  );
});

type StationOpsContract = Record<string, unknown>;

function expectStationOpsContract(value: unknown): void {
  const result = expectObject(value, "Station Ops result") as unknown as StationOpsContract;

  expect(Object.hasOwn(result, "departures"), "legacy departures key should not be emitted").toBe(
    false,
  );
  expect(Object.hasOwn(result, "arrivals"), "legacy arrivals key should not be emitted").toBe(
    false,
  );

  const panelEntries = Object.entries(result);
  expect(panelEntries.length, "Station Ops should include panel keys").toBeGreaterThan(0);

  for (const [panelLabel, rows] of panelEntries) {
    expect(Array.isArray(rows), `${panelLabel} should be an array`).toBe(true);

    for (const [index, row] of (rows as readonly unknown[]).slice(0, 5).entries()) {
      expectStationOpsRowContract(row, `${panelLabel}[${index}]`);
    }
  }
}

function expectStationOpsRowContract(value: unknown, label: string): void {
  const row = expectObject(value, label);
  const header = expectObject(row.header, `${label}.header`);
  const details = expectObject(row.details, `${label}.details`);

  expectNoLegacyFields(header, `${label}.header`);
  expectNoLegacyFields(details, `${label}.details`);

  for (const [key, fieldValue] of Object.entries(header)) {
    expectString(fieldValue, `${label}.header.${key}`);
  }

  for (const [key, fieldValue] of Object.entries(details)) {
    expectString(fieldValue, `${label}.details.${key}`);
  }
}

function expectStationOpsHeaderSanity(value: unknown, html: string): void {
  const result = expectObject(value, "Station Ops result") as unknown as StationOpsContract;
  const sourceRows = parseSourceHeaderRows(html);
  let checkedRows = 0;

  for (const sourceRow of sourceRows) {
    const rows = result[sourceRow.panelLabel];
    expect(Array.isArray(rows), `${sourceRow.panelLabel} should be present in parsed result`).toBe(
      true,
    );

    const row = expectObject(
      (rows as readonly unknown[])[sourceRow.rowIndex],
      `${sourceRow.panelLabel}[${sourceRow.rowIndex}]`,
    );
    const header = expectObject(row.header, `${sourceRow.label}.header`);
    const details = expectObject(row.details, `${sourceRow.label}.details`);

    if ("Destination" in header) {
      expectHeaderField(header, "Flight", sourceRow.cells[0] ?? "", sourceRow.label);
      expectHeaderField(header, "STD", sourceRow.cells[1] ?? "", sourceRow.label);
      expectHeaderField(header, "ATD", sourceRow.cells[2] ?? "", sourceRow.label);
      expectHeaderField(header, "Destination", sourceRow.cells[3] ?? "", sourceRow.label);
      expectHeaderField(header, "Registration", sourceRow.cells[4] ?? "", sourceRow.label);
      expectHeaderField(header, "Gate", sourceRow.cells[5] ?? "", sourceRow.label);
      expectHeaderField(header, "Pax", sourceRow.cells[7] ?? "", sourceRow.label);
      expectHeaderDetailsMatch(header, details, sourceRow.label, {
        scheduledTime: ["STD", "STD"],
        stationCode: ["Destination", "Arrival"],
        gate: ["Gate", "Dep Gate"],
      });
    } else {
      expectHeaderField(header, "Flight", sourceRow.cells[0] ?? "", sourceRow.label);
      expectHeaderField(header, "STA", sourceRow.cells[1] ?? "", sourceRow.label);
      expectHeaderField(header, "ATA", sourceRow.cells[2] ?? "", sourceRow.label);
      expectHeaderField(header, "Origin", sourceRow.cells[3] ?? "", sourceRow.label);
      expectHeaderField(header, "Registration", sourceRow.cells[4] ?? "", sourceRow.label);
      expectHeaderField(header, "Gate", sourceRow.cells[5] ?? "", sourceRow.label);
      expectHeaderField(header, "Pax", sourceRow.cells[7] ?? "", sourceRow.label);
      expectHeaderDetailsMatch(header, details, sourceRow.label, {
        scheduledTime: ["STA", "STA"],
        stationCode: ["Origin", "Departure"],
        gate: ["Gate", "Arr Gate"],
      });
    }

    expectString(header.Color, `${sourceRow.label}.header.Color`);
    expect(header.Color, `${sourceRow.label}.header.Color should be a CSS color`).toMatch(
      /^#[0-9a-f]{3,8}$|^[a-z]+$|^rgba?\(/i,
    );

    for (const index of [6, 8, 9]) {
      expect(
        sourceRow.cells[index] ?? "",
        `${sourceRow.label}.sourceCell[${index}] has live data but no Station Ops header key`,
      ).toBe("");
    }

    expect(sourceRow.cells.length, `${sourceRow.label} should not expose extra header cells`).toBe(
      10,
    );
    checkedRows += 1;
  }

  expect(
    checkedRows,
    "live Station Ops sanity check should inspect at least one row",
  ).toBeGreaterThan(0);
}

interface SourceHeaderRow {
  readonly panelLabel: string;
  readonly rowIndex: number;
  readonly label: string;
  readonly cells: readonly string[];
}

function parseSourceHeaderRows(html: string): SourceHeaderRow[] {
  const $ = load(html);
  const panels = [
    ["#panelUpperWrapper", textFrom($, "#MasterMain_lbUpper")],
    ["#panelLowerWrapper", textFrom($, "#MasterMain_lbLower")],
  ] as const;
  const sourceRows: SourceHeaderRow[] = [];

  for (const [selector, panelLabel] of panels) {
    $(selector)
      .find(".ListItem")
      .each((rowIndex, item) => {
        const cells = $(item)
          .find(".ActivityInfoRow td")
          .toArray()
          .map((cell) => normalizeText($(cell).text()));

        sourceRows.push({
          panelLabel,
          rowIndex,
          label: `${panelLabel}[${rowIndex}]`,
          cells,
        });
      });
  }

  return sourceRows;
}

function expectHeaderField(
  header: Record<string, unknown>,
  field: string,
  expectedValue: string,
  label: string,
): void {
  expectString(header[field], `${label}.header.${field}`);
  expect(header[field], `${label}.header.${field} should match source cell`).toBe(expectedValue);
}

function expectHeaderDetailsMatch(
  header: Record<string, unknown>,
  details: Record<string, unknown>,
  label: string,
  fields: {
    readonly scheduledTime: readonly [headerField: string, detailField: string];
    readonly stationCode: readonly [headerField: string, detailField: string];
    readonly gate: readonly [headerField: string, detailField: string];
  },
): void {
  expectFlight(header.Flight, `${label}.header.Flight`);
  expectTimeOrEmpty(header[fields.scheduledTime[0]], `${label}.header.${fields.scheduledTime[0]}`);
  expectTimeOrEmpty(
    details[fields.scheduledTime[1]],
    `${label}.details.${fields.scheduledTime[1]}`,
  );
  expect(header[fields.scheduledTime[0]], `${label} scheduled time should match details`).toBe(
    details[fields.scheduledTime[1]],
  );

  expectAirportCode(header[fields.stationCode[0]], `${label}.header.${fields.stationCode[0]}`);
  expect(header[fields.stationCode[0]], `${label} station code should match details`).toBe(
    airportCodeFromDetail(details[fields.stationCode[1]]),
  );

  if (details.Registration !== undefined) {
    expect(header.Registration, `${label} registration should match details`).toBe(
      details.Registration,
    );
  }

  if (details[fields.gate[1]] !== undefined) {
    expect(header[fields.gate[0]], `${label} gate should match details`).toBe(
      details[fields.gate[1]],
    );
  }

  expectString(header.Pax, `${label}.header.Pax`);
}

function expectFlight(value: unknown, label: string): void {
  expectString(value, label);
  expect(value, `${label} should not be empty`).not.toBe("");
  expect(value, `${label} should be a compact flight identifier`).toMatch(/^[A-Z0-9]+$/);
}

function expectTimeOrEmpty(value: unknown, label: string): void {
  expectString(value, label);
  expect(value, `${label} should be empty or HHMM`).toMatch(/^$|^\d{4}$/);
}

function expectAirportCode(value: unknown, label: string): void {
  expectString(value, label);
  expect(value, `${label} should be a station code`).toMatch(/^[A-Z0-9]{3,4}$/);
}

function airportCodeFromDetail(value: unknown): string {
  const text = expectString(value, "station detail");
  return text.split(" - ")[0] ?? "";
}

function expectNoLegacyFields(value: Record<string, unknown>, label: string): void {
  for (const field of [
    "raw",
    "flightNum",
    "dest",
    "origin",
    "depGate",
    "arrGate",
    "crewOnBoard",
    "registration",
    "gate",
    "pax",
    "color",
  ]) {
    expect(Object.hasOwn(value, field), `${label}.${field} should not be emitted`).toBe(false);
  }
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  expect(value, `${label} should be an object`).toBeTypeOf("object");
  expect(value, `${label} should not be null`).not.toBeNull();
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as Record<string, unknown>;
}

function expectString(value: unknown, label: string): string {
  expect(value, `${label} should be a string`).toBeTypeOf("string");
  return value as string;
}

function textFrom($: ReturnType<typeof load>, selector: string): string {
  return normalizeText($(selector).first().text());
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
