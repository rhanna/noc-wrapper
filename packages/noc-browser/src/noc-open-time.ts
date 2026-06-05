import { NocBrowserError, NocJsonError, NocRevisionAckRequiredError } from "./errors.js";
import { REVISION_PATH } from "./lib/noc-url-utils.js";
import type { NocBrowser } from "./noc-browser.js";
import { hasRevisionAckRequiredHtml, parseRevisionAckDetails } from "./noc-revision-ack.js";

const OPEN_TIME_API_PATH = "/api/open-time";

export interface NocOpenTimeRawObject {
  readonly [key: string]: unknown;
}

export interface NocOpenTimeBaseOptions {
  readonly baseId: number;
}

export interface NocNetReserveOptions {
  readonly isSap?: boolean;
}

export type NocOpenTimeUserContextResult = NocOpenTimeRawObject;
export type NocOpenTimeRosterResult = NocOpenTimeRawObject;
export type NocOpenTimeRosterLegalityValuesResult = NocOpenTimeRawObject;
export type NocOpenTimePairingsResult = NocOpenTimeRawObject;
export type NocOpenTimePairingsLegalityValuesResult = NocOpenTimeRawObject;
export type NocOpenTimePairingsBlockDetailsResult = NocOpenTimeRawObject;
export type NocNetReserveResult = NocOpenTimeRawObject;

export async function getOpenTimeUserContext(
  browser: NocBrowser,
): Promise<NocOpenTimeUserContextResult> {
  return getOpenTimeJsonApi<NocOpenTimeUserContextResult>(
    browser,
    `${OPEN_TIME_API_PATH}/user-context`,
  );
}

export async function getOpenTimeRoster(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimeRosterResult> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimeRosterResult>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/1?baseId=${options.baseId}`,
  );
}

export async function getOpenTimeRosterLegalityValues(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimeRosterLegalityValuesResult> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimeRosterLegalityValuesResult>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/1/legality?baseId=${options.baseId}`,
  );
}

export async function getOpenTimePairings(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimePairingsResult> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimePairingsResult>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/2?baseId=${options.baseId}`,
  );
}

export async function getOpenTimePairingsLegalityValues(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimePairingsLegalityValuesResult> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimePairingsLegalityValuesResult>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/2/legality?baseId=${options.baseId}`,
  );
}

export async function getOpenTimePairingsBlockDetails(
  browser: NocBrowser,
  pairingId: number,
): Promise<NocOpenTimePairingsBlockDetailsResult> {
  validatePositiveInteger("pairingId", pairingId);

  return getOpenTimeJsonApi<NocOpenTimePairingsBlockDetailsResult>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/2/block-details/${pairingId}`,
  );
}

export async function getNetReserve(
  browser: NocBrowser,
  options: NocNetReserveOptions = {},
): Promise<NocNetReserveResult> {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new NocBrowserError("NOC Net Reserve options must be an object");
  }

  const isSap = options.isSap ?? false;

  if (typeof isSap !== "boolean") {
    throw new NocBrowserError("NOC Net Reserve isSap must be a boolean");
  }

  return getOpenTimeJsonApi<NocNetReserveResult>(
    browser,
    `${OPEN_TIME_API_PATH}/net-reserve?isSap=${isSap}`,
  );
}

async function getOpenTimeJsonApi<T>(browser: NocBrowser, path: string): Promise<T> {
  try {
    return await browser.getJsonApi<T>(path);
  } catch (error) {
    if (error instanceof NocJsonError && hasRevisionAckRequiredHtml(error.body)) {
      throwRevisionAckRequired(browser, error.body);
    }

    throw error;
  }
}

function throwRevisionAckRequired(browser: NocBrowser, html: string): never {
  throw new NocRevisionAckRequiredError(
    "NOC revision acknowledgement is required before completing the Open Time request",
    parseRevisionAckDetails(html, browser.resolveUrl(REVISION_PATH)),
  );
}

function validateBaseOptions(options: NocOpenTimeBaseOptions): void {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new NocBrowserError("NOC Open Time base options are required");
  }

  validatePositiveInteger("baseId", options.baseId);
}

function validatePositiveInteger(name: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new NocBrowserError(`NOC Open Time ${name} must be a positive integer`);
  }
}
