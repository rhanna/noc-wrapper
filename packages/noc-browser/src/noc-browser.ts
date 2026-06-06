import { AbstractBrowser } from "./lib/browser/abstract-browser.js";
import { NocLoginPage, type NocAuthenticationResultRaw } from "./noc-auth.js";
import {
  getNetReserve,
  getOpenTimePairings,
  getOpenTimePairingsBlockDetails,
  getOpenTimePairingsLegalityValues,
  getOpenTimeRoster,
  getOpenTimeRosterLegalityValues,
  getOpenTimeUserContext,
  type NocNetReserveOptions,
  type NocNetReserveResultRaw,
  type NocOpenTimeBaseOptions,
  type NocOpenTimePairingsBlockDetailsResultRaw,
  type NocOpenTimePairingsLegalityValuesResultRaw,
  type NocOpenTimePairingsResultRaw,
  type NocOpenTimeRosterLegalityValuesResultRaw,
  type NocOpenTimeRosterResultRaw,
  type NocOpenTimeUserContextResultRaw,
} from "./noc-open-time.js";
import {
  getCrewOnBoardDetails,
  getCurrentUserInfo,
  getHumanResources,
  getRoster,
  getRosterMonthlyAccumulatedValues,
  type NocCrewOnBoardDetailsResultRaw,
  type NocCurrentUserInfoResultRaw,
  type NocHumanResourcesResultRaw,
  type NocRosterOptions,
  type NocRosterMonthlyAccumulatedValuesResultRaw,
  type NocRosterResultRaw,
} from "./noc-roster.js";
import {
  NocRevisionPage,
  type NocConfirmRevisionResultRaw,
  type NocRevisionResultRaw,
} from "./noc-revision-page.js";
import {
  getStationOps,
  NocStationOpsPage,
  type NocStationOpsOptions,
  type NocStationOpsResultRaw,
} from "./noc-station-ops.js";
import type { BrowserOptions } from "./types.js";

/**
 * Low-level NOC portal I/O client.
 * NOT thread-safe. Callers are responsible for serializing access.
 * One instance should be held per authenticated user session.
 *
 * What NocBrowser Should Do
 * Since it's stateful (it holds a cookie jar / fetch session), it should:
 *   - Throw descriptive errors that upper layers can act on
 *     — e.g. SessionExpiredError, AuthFailedError, ParseError — not generic fetch errors
 *   - Be stateless between calls beyond the cookie jar it manages
 *   - Have no retry logic, no enrichment, no queuing
 * The rich error types are the most important contract NocBrowser provides upward.
 * NocWrapper needs to know why something failed to decide whether to retry or re-auth.
 * If NocBrowser just throws Error: fetch failed, the upper layers are flying blind.
 *
 * What NocBrowser Should Not Do
 *  - Retry on failure
 *  - Re-login on session expiry
 *  - Queue or serialize requests
 *  - Know anything about users or sessions beyond its own cookie jar
 */
export class NocBrowser extends AbstractBrowser {
  readonly #loginPage: NocLoginPage;
  readonly #revisionPage: NocRevisionPage;
  readonly #stationOpsPage: NocStationOpsPage;

  constructor(options: BrowserOptions) {
    super(options);
    this.#loginPage = new NocLoginPage(this);
    this.#revisionPage = new NocRevisionPage(this);
    this.#stationOpsPage = new NocStationOpsPage(this);
  }

  async authenticate(username: string, password: string): Promise<NocAuthenticationResultRaw> {
    return this.#loginPage.authenticate(username, password);
  }

  async getHumanResources(): Promise<NocHumanResourcesResultRaw> {
    return getHumanResources(this);
  }

  async getCurrentUserInfo(): Promise<NocCurrentUserInfoResultRaw> {
    return getCurrentUserInfo(this);
  }

  async getRoster(options: NocRosterOptions): Promise<NocRosterResultRaw> {
    return getRoster(this, options);
  }

  async getCrewOnBoardDetails(activityId: number): Promise<NocCrewOnBoardDetailsResultRaw> {
    return getCrewOnBoardDetails(this, activityId);
  }

  async getRosterMonthlyAccumulatedValues(
    options: NocRosterOptions,
  ): Promise<NocRosterMonthlyAccumulatedValuesResultRaw> {
    return getRosterMonthlyAccumulatedValues(this, options);
  }

  async getOpenTimeUserContext(): Promise<NocOpenTimeUserContextResultRaw> {
    return getOpenTimeUserContext(this);
  }

  async getOpenTimeRoster(options: NocOpenTimeBaseOptions): Promise<NocOpenTimeRosterResultRaw> {
    return getOpenTimeRoster(this, options);
  }

  async getOpenTimeRosterLegalityValues(
    options: NocOpenTimeBaseOptions,
  ): Promise<NocOpenTimeRosterLegalityValuesResultRaw> {
    return getOpenTimeRosterLegalityValues(this, options);
  }

  async getOpenTimePairings(
    options: NocOpenTimeBaseOptions,
  ): Promise<NocOpenTimePairingsResultRaw> {
    return getOpenTimePairings(this, options);
  }

  async getOpenTimePairingsLegalityValues(
    options: NocOpenTimeBaseOptions,
  ): Promise<NocOpenTimePairingsLegalityValuesResultRaw> {
    return getOpenTimePairingsLegalityValues(this, options);
  }

  async getOpenTimePairingsBlockDetails(
    pairingId: number,
  ): Promise<NocOpenTimePairingsBlockDetailsResultRaw> {
    return getOpenTimePairingsBlockDetails(this, pairingId);
  }

  async getNetReserve(options: NocNetReserveOptions = {}): Promise<NocNetReserveResultRaw> {
    return getNetReserve(this, options);
  }

  async getStationOps(options: NocStationOpsOptions): Promise<NocStationOpsResultRaw> {
    return getStationOps(this.#stationOpsPage, options);
  }

  async getRevision(): Promise<NocRevisionResultRaw> {
    return this.#revisionPage.getRevision();
  }

  async confirmRevision(): Promise<NocConfirmRevisionResultRaw> {
    return this.#revisionPage.confirmRevision();
  }

  async hasRevisionAckRequired(): Promise<boolean> {
    return this.#revisionPage.hasRevisionAckRequired();
  }
}
