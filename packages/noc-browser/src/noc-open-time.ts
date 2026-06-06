import { NocBrowserError, NocJsonError, NocRevisionAckRequiredError } from "./errors.js";
import { REVISION_PATH } from "./lib/noc-url-utils.js";
import type { NocBrowser } from "./noc-browser.js";
import { hasRevisionAckRequiredHtml, parseRevisionAckDetails } from "./noc-revision-ack.js";
import type { NocJsonObject } from "./types.js";

const OPEN_TIME_API_PATH = "/api/open-time";

/**
 * Raw JSON-compatible object returned by NOC Open Time APIs.
 */
export type NocOpenTimeRawObject = NocJsonObject;

/**
 * Required base identifier for Open Time roster, pairing, and legality calls.
 */
export interface NocOpenTimeBaseOptions {
  /** NOC base identifier. */
  readonly baseId: number;
}

/**
 * Options for the Net Reserve API.
 */
export interface NocNetReserveOptions {
  /** Whether to request SAP net reserve values. Defaults to `false`. */
  readonly isSap?: boolean;
}

/**
 * Raw Open Time user context payload returned unchanged from NOC.
 */
export type NocOpenTimeUserContextResultRaw = NocOpenTimeRawObject;

/**
 * Raw Open Time roster payload returned unchanged from NOC.
 */
export type NocOpenTimeRosterResultRaw = NocOpenTimeRawObject;

/**
 * Raw Open Time roster legality payload returned unchanged from NOC.
 */
export type NocOpenTimeRosterLegalityValuesResultRaw = NocOpenTimeRawObject;

/**
 * Raw Open Time pairings payload returned unchanged from NOC.
 */
export type NocOpenTimePairingsResultRaw = NocOpenTimeRawObject;

/**
 * Raw Open Time pairings legality payload returned unchanged from NOC.
 */
export type NocOpenTimePairingsLegalityValuesResultRaw = NocOpenTimeRawObject;

/**
 * Raw Open Time pairing block-details payload returned unchanged from NOC.
 */
export type NocOpenTimePairingsBlockDetailsResultRaw = NocOpenTimeRawObject;

/**
 * Raw Net Reserve payload returned unchanged from NOC.
 */
export type NocNetReserveResultRaw = NocOpenTimeRawObject;

export async function getOpenTimeUserContext(
  browser: NocBrowser,
): Promise<NocOpenTimeUserContextResultRaw> {
  return getOpenTimeJsonApi<NocOpenTimeUserContextResultRaw>(
    browser,
    `${OPEN_TIME_API_PATH}/user-context`,
  );
}

export async function getOpenTimeRoster(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimeRosterResultRaw> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimeRosterResultRaw>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/1?baseId=${options.baseId}`,
  );
}

export async function getOpenTimeRosterLegalityValues(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimeRosterLegalityValuesResultRaw> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimeRosterLegalityValuesResultRaw>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/1/legality?baseId=${options.baseId}`,
  );
}

export async function getOpenTimePairings(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimePairingsResultRaw> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimePairingsResultRaw>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/2?baseId=${options.baseId}`,
  );
}

export async function getOpenTimePairingsLegalityValues(
  browser: NocBrowser,
  options: NocOpenTimeBaseOptions,
): Promise<NocOpenTimePairingsLegalityValuesResultRaw> {
  validateBaseOptions(options);

  return getOpenTimeJsonApi<NocOpenTimePairingsLegalityValuesResultRaw>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/2/legality?baseId=${options.baseId}`,
  );
}

export async function getOpenTimePairingsBlockDetails(
  browser: NocBrowser,
  pairingId: number,
): Promise<NocOpenTimePairingsBlockDetailsResultRaw> {
  validatePositiveInteger("pairingId", pairingId);

  return getOpenTimeJsonApi<NocOpenTimePairingsBlockDetailsResultRaw>(
    browser,
    `${OPEN_TIME_API_PATH}/rosters/2/block-details/${pairingId}`,
  );
}

export async function getNetReserve(
  browser: NocBrowser,
  options: NocNetReserveOptions = {},
): Promise<NocNetReserveResultRaw> {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new NocBrowserError("NOC Net Reserve options must be an object");
  }

  const isSap = options.isSap ?? false;

  if (typeof isSap !== "boolean") {
    throw new NocBrowserError("NOC Net Reserve isSap must be a boolean");
  }

  return getOpenTimeJsonApi<NocNetReserveResultRaw>(
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
