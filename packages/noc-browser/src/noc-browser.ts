import { AbstractBrowser } from "./lib/browser/abstract-browser.js";
import { NocLoginPage, type NocAuthenticationResult } from "./noc-auth.js";
import {
  getCrewOnBoardDetails,
  getCurrentUserInfo,
  getHumanResources,
  getRoster,
  getRosterMonthlyAccumulatedValues,
  type NocCrewOnBoardDetailsResult,
  type NocCurrentUserInfoResult,
  type NocHumanResourcesResult,
  type NocRosterOptions,
  type NocRosterMonthlyAccumulatedValuesResult,
  type NocRosterResult,
} from "./noc-roster.js";
import {
  NocRevisionPage,
  type NocConfirmRevisionResult,
  type NocRevisionResult,
} from "./noc-revision-page.js";
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

  constructor(options: BrowserOptions) {
    super(options);
    this.#loginPage = new NocLoginPage(this);
    this.#revisionPage = new NocRevisionPage(this);
  }

  async authenticate(username: string, password: string): Promise<NocAuthenticationResult> {
    return this.#loginPage.authenticate(username, password);
  }

  async getHumanResources(): Promise<NocHumanResourcesResult> {
    return getHumanResources(this);
  }

  async getCurrentUserInfo(): Promise<NocCurrentUserInfoResult> {
    return getCurrentUserInfo(this);
  }

  async getRoster(options: NocRosterOptions): Promise<NocRosterResult> {
    return getRoster(this, options);
  }

  async getCrewOnBoardDetails(activityId: number): Promise<NocCrewOnBoardDetailsResult> {
    return getCrewOnBoardDetails(this, activityId);
  }

  async getRosterMonthlyAccumulatedValues(
    options: NocRosterOptions,
  ): Promise<NocRosterMonthlyAccumulatedValuesResult> {
    return getRosterMonthlyAccumulatedValues(this, options);
  }

  async getRevision(): Promise<NocRevisionResult> {
    return this.#revisionPage.getRevision();
  }

  async confirmRevision(): Promise<NocConfirmRevisionResult> {
    return this.#revisionPage.confirmRevision();
  }

  async hasRevisionAckRequired(): Promise<boolean> {
    return this.#revisionPage.hasRevisionAckRequired();
  }
}
