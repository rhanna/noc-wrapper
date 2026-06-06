import { NocBrowserError, NocJsonError, NocRevisionAckRequiredError } from "./errors.js";
import { REVISION_PATH } from "./lib/noc-url-utils.js";
import type { NocBrowser } from "./noc-browser.js";
import { hasRevisionAckRequiredHtml, parseRevisionAckDetails } from "./noc-revision-ack.js";
import type { NocJsonObject, NocJsonValue } from "./types.js";

const HUMAN_RESOURCE_ROSTER_PATH = "/Dialogues/HumanResources/HumanResourceRoster.aspx";
const CREW_ON_BOARD_DETAILS_PATH = "/Dialogues/HumanResources/HumanResourceCrewOnBoardDetails.aspx";

export type NocRosterRawObject = NocJsonObject;

export type NocHumanResourcesResultRaw = NocRosterRawObject;
export type NocCurrentUserInfoResultRaw = NocRosterRawObject;

export interface NocRosterOptions {
  readonly month: number;
  readonly year: number;
  readonly hrId: number;
}

export type NocRosterResultRaw = NocRosterRawObject;
export type NocCrewOnBoardDetailsResultRaw = NocRosterRawObject;

export interface NocRosterMonthlyAccumulatedValueRaw {
  readonly Label?: NocJsonValue;
  readonly Value?: NocJsonValue;
  readonly [key: string]: NocJsonValue | undefined;
}

export interface NocRosterMonthlyAccumulatedValuesResultRaw {
  readonly AccumulatedValues?: readonly NocRosterMonthlyAccumulatedValueRaw[];
  readonly [key: string]: NocJsonValue | undefined;
}

export async function getHumanResources(browser: NocBrowser): Promise<NocHumanResourcesResultRaw> {
  return postRosterWebMethod<NocHumanResourcesResultRaw>(
    browser,
    `${HUMAN_RESOURCE_ROSTER_PATH}/GetHumanResources`,
    {},
  );
}

export async function getCurrentUserInfo(
  browser: NocBrowser,
): Promise<NocCurrentUserInfoResultRaw> {
  return postRosterWebMethod<NocCurrentUserInfoResultRaw>(
    browser,
    `${HUMAN_RESOURCE_ROSTER_PATH}/GetCurrentUserInfo`,
    {
      hrId: -1,
    },
  );
}

export async function getRoster(
  browser: NocBrowser,
  options: NocRosterOptions,
): Promise<NocRosterResultRaw> {
  validateRosterOptions(options);

  return postRosterWebMethod<NocRosterResultRaw>(
    browser,
    `${HUMAN_RESOURCE_ROSTER_PATH}/GetRoster`,
    {
      month: options.month,
      year: options.year,
      hrId: options.hrId,
    },
  );
}

export async function getCrewOnBoardDetails(
  browser: NocBrowser,
  activityId: number,
): Promise<NocCrewOnBoardDetailsResultRaw> {
  validatePositiveInteger("activityId", activityId);

  return postRosterWebMethod<NocCrewOnBoardDetailsResultRaw>(
    browser,
    `${CREW_ON_BOARD_DETAILS_PATH}/GetCrewOnBoardDetails`,
    {
      activityId,
    },
  );
}

export async function getRosterMonthlyAccumulatedValues(
  browser: NocBrowser,
  options: NocRosterOptions,
): Promise<NocRosterMonthlyAccumulatedValuesResultRaw> {
  validateRosterOptions(options);

  return postRosterWebMethod<NocRosterMonthlyAccumulatedValuesResultRaw>(
    browser,
    `${HUMAN_RESOURCE_ROSTER_PATH}/GetMonthlyAccumulatedValues`,
    {
      month: options.month,
      year: options.year,
      hrId: options.hrId,
    },
  );
}

async function postRosterWebMethod<T>(
  browser: NocBrowser,
  path: string,
  payload: NocJsonObject,
): Promise<T> {
  try {
    const result = await browser.postWebMethod<T>(path, payload);

    if (typeof result === "string" && hasRevisionAckRequiredHtml(result)) {
      throwRevisionAckRequired(browser, result);
    }

    return result;
  } catch (error) {
    if (error instanceof NocJsonError && hasRevisionAckRequiredHtml(error.body)) {
      throwRevisionAckRequired(browser, error.body);
    }

    throw error;
  }
}

function throwRevisionAckRequired(browser: NocBrowser, html: string): never {
  throw new NocRevisionAckRequiredError(
    "NOC revision acknowledgement is required before completing the Roster request",
    parseRevisionAckDetails(html, browser.resolveUrl(REVISION_PATH)),
  );
}

function validateRosterOptions(options: NocRosterOptions): void {
  validateOptionsObject(options);

  if (!Number.isInteger(options.month) || options.month < 1 || options.month > 12) {
    throw new NocBrowserError("NOC Roster month must be an integer from 1 to 12");
  }

  if (!Number.isInteger(options.year) || options.year < 1) {
    throw new NocBrowserError("NOC Roster year must be a positive integer");
  }

  if (!Number.isInteger(options.hrId) || options.hrId < 1) {
    throw new NocBrowserError("NOC Roster hrId must be a positive integer");
  }
}

function validateOptionsObject(options: unknown): asserts options is Record<string, unknown> {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    throw new NocBrowserError("NOC Roster options are required");
  }
}

function validatePositiveInteger(name: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new NocBrowserError(`NOC Roster ${name} must be a positive integer`);
  }
}
