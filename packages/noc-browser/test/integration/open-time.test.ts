import { describe, expect, it } from "vitest";
import { NocBrowser } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

describe("Open Time integration", () => {
  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "fetches user context, roster, pairings, legality values, block details, and net reserve",
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

      const userContext = await browser.getOpenTimeUserContext();
      const baseId = expectOpenTimeUserContextContract(userContext);

      const roster = await browser.getOpenTimeRoster({ baseId });
      expectOpenTimeRosterContract(roster);

      const rosterLegalityValues = await browser.getOpenTimeRosterLegalityValues({ baseId });
      expectOpenTimeLegalityValuesContract(rosterLegalityValues, "Open Time roster legality");

      const pairings = await browser.getOpenTimePairings({ baseId });
      const pairingId = expectOpenTimePairingsContract(pairings);

      const pairingsLegalityValues = await browser.getOpenTimePairingsLegalityValues({ baseId });
      expectOpenTimeLegalityValuesContract(pairingsLegalityValues, "Open Time pairings legality");

      if (pairingId !== undefined) {
        const blockDetails = await browser.getOpenTimePairingsBlockDetails(pairingId);
        expectOpenTimeBlockDetailsContract(blockDetails);
      }

      const netReserve = await browser.getNetReserve();
      expectNetReserveContract(netReserve);
    },
  );
});

function expectOpenTimeUserContextContract(userContext: unknown): number {
  const root = expectObject(userContext, "Open Time user context");
  expectBoolean(root.isSAPOpen, "isSAPOpen");
  expectBoolean(root.isFirstComeFirstServed, "isFirstComeFirstServed");

  const bases = expectArray(root.bases, "bases");
  expect(bases.length, "bases should include at least one Open Time base").toBeGreaterThan(0);

  let defaultBaseId: number | undefined;
  let firstBaseId: number | undefined;

  for (const [index, base] of bases.entries()) {
    const baseObject = expectObject(base, `bases[${index}]`);
    const baseId = expectPositiveInteger(baseObject.id, `bases[${index}].id`);
    expectNonEmptyString(baseObject.name, `bases[${index}].name`);

    if ("default" in baseObject) {
      const isDefault = expectBoolean(baseObject.default, `bases[${index}].default`);

      if (isDefault) {
        defaultBaseId = baseId;
      }
    }

    firstBaseId ??= baseId;
  }

  return defaultBaseId ?? firstBaseId ?? 0;
}

function expectOpenTimeRosterContract(roster: unknown): void {
  const results = expectResultsArray(roster, "Open Time roster");

  for (const [index, result] of results.slice(0, 10).entries()) {
    const rosterItem = expectObject(result, `Open Time roster results[${index}]`);
    expectPositiveInteger(rosterItem.id, `Open Time roster results[${index}].id`);
    expectString(rosterItem.activityCode, `Open Time roster results[${index}].activityCode`);
    expectString(rosterItem.rosterRank, `Open Time roster results[${index}].rosterRank`);
    expectBoolean(rosterItem.isPairing, `Open Time roster results[${index}].isPairing`);

    if ("date" in rosterItem) {
      expectDateString(rosterItem.date, `Open Time roster results[${index}].date`);
    }
  }
}

function expectOpenTimePairingsContract(pairings: unknown): number | undefined {
  const results = expectResultsArray(pairings, "Open Time pairings");
  let pairingId: number | undefined;

  for (const [index, result] of results.slice(0, 10).entries()) {
    const pairing = expectObject(result, `Open Time pairings results[${index}]`);
    const id = expectPositiveInteger(pairing.id, `Open Time pairings results[${index}].id`);
    expectString(pairing.activityCode, `Open Time pairings results[${index}].activityCode`);
    expectBoolean(pairing.isPairing, `Open Time pairings results[${index}].isPairing`);

    if ("date" in pairing) {
      expectDateString(pairing.date, `Open Time pairings results[${index}].date`);
    }

    pairingId ??= id;
  }

  return pairingId;
}

function expectOpenTimeLegalityValuesContract(response: unknown, label: string): void {
  const results = expectResultsArray(response, label);

  for (const [index, result] of results.slice(0, 10).entries()) {
    const legality = expectObject(result, `${label} results[${index}]`);
    expectPositiveInteger(legality.id, `${label} results[${index}].id`);
    expectDateString(legality.date, `${label} results[${index}].date`);
    const values = expectArray(
      legality.legalityValues,
      `${label} results[${index}].legalityValues`,
    );

    for (const [valueIndex, value] of values.slice(0, 5).entries()) {
      const valueObject = expectObject(
        value,
        `${label} results[${index}].legalityValues[${valueIndex}]`,
      );
      expectString(valueObject.key, `${label} legalityValues[${valueIndex}].key`);
      expectString(valueObject.value, `${label} legalityValues[${valueIndex}].value`);
    }
  }
}

function expectOpenTimeBlockDetailsContract(blockDetails: unknown): void {
  const results = expectResultsArray(blockDetails, "Open Time block details");

  for (const [index, result] of results.slice(0, 10).entries()) {
    const detail = expectObject(result, `Open Time block details results[${index}]`);
    expectPositiveInteger(
      detail.activityId,
      `Open Time block details results[${index}].activityId`,
    );
    expectPositiveInteger(
      detail.assignedPairingId,
      `Open Time block details results[${index}].assignedPairingId`,
    );
    expectString(detail.activityCode, `Open Time block details results[${index}].activityCode`);
    expectString(detail.dep, `Open Time block details results[${index}].dep`);
    expectString(detail.arr, `Open Time block details results[${index}].arr`);
  }
}

function expectNetReserveContract(netReserve: unknown): void {
  const results = expectResultsArray(netReserve, "Net Reserve");

  for (const [index, result] of results.slice(0, 5).entries()) {
    const resultObject = expectObject(result, `Net Reserve results[${index}]`);

    if ("grids" in resultObject) {
      expectArray(resultObject.grids, `Net Reserve results[${index}].grids`);
    }
  }
}

function expectResultsArray(response: unknown, label: string): unknown[] {
  const root = expectObject(response, `${label} response`);
  return expectArray(root.results, `${label} results`);
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  expect(value, `${label} should be an object`).toBeTypeOf("object");
  expect(value, `${label} should not be null`).not.toBeNull();
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): unknown[] {
  expect(Array.isArray(value), `${label} should be an array`).toBe(true);
  return value as unknown[];
}

function expectPositiveInteger(value: unknown, label: string): number {
  expect(value, `${label} should be a number`).toBeTypeOf("number");
  expect(Number.isInteger(value), `${label} should be an integer`).toBe(true);
  expect(value as number, `${label} should be positive`).toBeGreaterThan(0);
  return value as number;
}

function expectBoolean(value: unknown, label: string): boolean {
  expect(value, `${label} should be a boolean`).toBeTypeOf("boolean");
  return value as boolean;
}

function expectString(value: unknown, label: string): string {
  expect(value, `${label} should be a string`).toBeTypeOf("string");
  return value as string;
}

function expectNonEmptyString(value: unknown, label: string): string {
  const stringValue = expectString(value, label);
  expect(stringValue.trim().length, `${label} should not be empty`).toBeGreaterThan(0);
  return stringValue;
}

function expectDateString(value: unknown, label: string): string {
  const dateString = expectNonEmptyString(value, label);
  expect(Number.isNaN(new Date(dateString).getTime()), `${label} should parse as a date`).toBe(
    false,
  );
  return dateString;
}
