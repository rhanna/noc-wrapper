import { describe, expect, it } from "vitest";
import { NocBrowser, StationOpsSort, StationOpsTimeMode } from "../../src/index.js";

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
    },
    90000,
  );
});

interface StationOpsContract {
  readonly departures: readonly unknown[];
  readonly arrivals: readonly unknown[];
}

function expectStationOpsContract(value: unknown): void {
  const result = expectObject(value, "Station Ops result") as unknown as StationOpsContract;
  expect(Array.isArray(result.departures), "departures should be an array").toBe(true);
  expect(Array.isArray(result.arrivals), "arrivals should be an array").toBe(true);

  for (const [index, departure] of result.departures.slice(0, 5).entries()) {
    expectDepartureContract(departure, index);
  }

  for (const [index, arrival] of result.arrivals.slice(0, 5).entries()) {
    expectArrivalContract(arrival, index);
  }
}

function expectDepartureContract(value: unknown, index: number): void {
  const departure = expectObject(value, `departures[${index}]`);
  const header = expectObject(departure.header, `departures[${index}].header`);
  const details = expectObject(departure.details, `departures[${index}].details`);

  expectString(header.flightNum, `departures[${index}].header.flightNum`);
  expectString(header.STD, `departures[${index}].header.STD`);
  expectString(header.ATD, `departures[${index}].header.ATD`);
  expectString(header.dest, `departures[${index}].header.dest`);
  expectString(header.registration, `departures[${index}].header.registration`);
  expectString(header.gate, `departures[${index}].header.gate`);
  expectString(header.pax, `departures[${index}].header.pax`);
  expectString(header.color, `departures[${index}].header.color`);
  expect(Array.isArray(header.raw), `departures[${index}].header.raw should be an array`).toBe(
    true,
  );
  expectStationOpsDetailsContract(details, `departures[${index}].details`);
}

function expectArrivalContract(value: unknown, index: number): void {
  const arrival = expectObject(value, `arrivals[${index}]`);
  const header = expectObject(arrival.header, `arrivals[${index}].header`);
  const details = expectObject(arrival.details, `arrivals[${index}].details`);

  expectString(header.flightNum, `arrivals[${index}].header.flightNum`);
  expectString(header.STA, `arrivals[${index}].header.STA`);
  expectString(header.ATA, `arrivals[${index}].header.ATA`);
  expectString(header.origin, `arrivals[${index}].header.origin`);
  expectString(header.registration, `arrivals[${index}].header.registration`);
  expectString(header.gate, `arrivals[${index}].header.gate`);
  expectString(header.pax, `arrivals[${index}].header.pax`);
  expectString(header.color, `arrivals[${index}].header.color`);
  expect(Array.isArray(header.raw), `arrivals[${index}].header.raw should be an array`).toBe(true);
  expectStationOpsDetailsContract(details, `arrivals[${index}].details`);
}

function expectStationOpsDetailsContract(details: Record<string, unknown>, label: string): void {
  expect(Array.isArray(details.raw), `${label}.raw should be an array`).toBe(true);

  for (const field of [
    "date",
    "departure",
    "arrival",
    "STD",
    "STA",
    "registration",
    "version",
    "type",
    "depGate",
    "arrGate",
    "crewOnBoard",
    "delay",
    "pax",
    "notes",
  ]) {
    if (field in details && details[field] !== undefined) {
      expectString(details[field], `${label}.${field}`);
    }
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
