import { NocBrowserError } from "./errors.js";
import type { NocBrowser } from "./noc-browser.js";

const HUMAN_RESOURCE_ROSTER_PATH = "/Dialogues/HumanResources/HumanResourceRoster.aspx";

export interface NocRosterMonthlyAccumulatedValuesOptions {
  readonly month: number;
  readonly year: number;
  readonly hrId: number;
}

export interface NocRosterMonthlyAccumulatedValue {
  readonly Label?: unknown;
  readonly Value?: unknown;
  readonly [key: string]: unknown;
}

export interface NocRosterMonthlyAccumulatedValuesResult {
  readonly AccumulatedValues?: readonly NocRosterMonthlyAccumulatedValue[];
  readonly [key: string]: unknown;
}

export async function getRosterMonthlyAccumulatedValues(
  browser: NocBrowser,
  options: NocRosterMonthlyAccumulatedValuesOptions,
): Promise<NocRosterMonthlyAccumulatedValuesResult> {
  validateRosterMonthlyAccumulatedValuesOptions(options);

  return browser.postWebMethod<NocRosterMonthlyAccumulatedValuesResult>(
    `${HUMAN_RESOURCE_ROSTER_PATH}/GetMonthlyAccumulatedValues`,
    {
      month: options.month,
      year: options.year,
      hrId: options.hrId,
    },
  );
}

function validateRosterMonthlyAccumulatedValuesOptions(
  options: NocRosterMonthlyAccumulatedValuesOptions,
): void {
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
