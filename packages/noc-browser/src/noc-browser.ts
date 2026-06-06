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
 * Low-level stateful client for direct NOC portal I/O.
 *
 * Hold one instance per authenticated NOC user session. Results are raw NOC
 * payloads or page-shaped structures; this layer does not retry, re-login,
 * enrich, sort, normalize, or implement product workflows.
 */
export class NocBrowser extends AbstractBrowser {
  readonly #loginPage: NocLoginPage;
  readonly #revisionPage: NocRevisionPage;
  readonly #stationOpsPage: NocStationOpsPage;

  /**
   * Creates a browser session for one NOC portal base URL.
   *
   * @param options - Base URL and optional fetch or cookie jar overrides.
   */
  constructor(options: BrowserOptions) {
    super(options);
    this.#loginPage = new NocLoginPage(this);
    this.#revisionPage = new NocRevisionPage(this);
    this.#stationOpsPage = new NocStationOpsPage(this);
  }

  /**
   * Authenticates against the NOC login page with a username and password.
   *
   * @param username - NOC username.
   * @param password - NOC password.
   * @returns Raw authentication status, including revision acknowledgement state.
   * @throws NocAuthenticationError when login fails or credentials are missing.
   */
  async authenticate(username: string, password: string): Promise<NocAuthenticationResultRaw> {
    return this.#loginPage.authenticate(username, password);
  }

  /**
   * Fetches the raw human resources WebMethod payload.
   *
   * @returns NOC payload unchanged after ASP.NET `.d` unwrapping.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getHumanResources(): Promise<NocHumanResourcesResultRaw> {
    return getHumanResources(this);
  }

  /**
   * Fetches the raw current-user WebMethod payload for the authenticated session.
   *
   * @returns NOC payload unchanged after ASP.NET `.d` unwrapping.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getCurrentUserInfo(): Promise<NocCurrentUserInfoResultRaw> {
    return getCurrentUserInfo(this);
  }

  /**
   * Fetches a raw roster payload for the supplied NOC roster identifiers.
   *
   * @param options - Required month, year, and NOC human resource ID.
   * @returns NOC roster payload unchanged after ASP.NET `.d` unwrapping.
   * @throws NocBrowserError when required options are invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getRoster(options: NocRosterOptions): Promise<NocRosterResultRaw> {
    return getRoster(this, options);
  }

  /**
   * Fetches raw crew-on-board details for a NOC activity.
   *
   * @param activityId - Positive NOC activity identifier.
   * @returns NOC payload unchanged after ASP.NET `.d` unwrapping.
   * @throws NocBrowserError when `activityId` is invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getCrewOnBoardDetails(activityId: number): Promise<NocCrewOnBoardDetailsResultRaw> {
    return getCrewOnBoardDetails(this, activityId);
  }

  /**
   * Fetches raw monthly accumulated roster values.
   *
   * @param options - Required month, year, and NOC human resource ID.
   * @returns NOC payload unchanged after ASP.NET `.d` unwrapping.
   * @throws NocBrowserError when required options are invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getRosterMonthlyAccumulatedValues(
    options: NocRosterOptions,
  ): Promise<NocRosterMonthlyAccumulatedValuesResultRaw> {
    return getRosterMonthlyAccumulatedValues(this, options);
  }

  /**
   * Fetches the raw Open Time user context payload.
   *
   * @returns NOC Open Time user context unchanged.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getOpenTimeUserContext(): Promise<NocOpenTimeUserContextResultRaw> {
    return getOpenTimeUserContext(this);
  }

  /**
   * Fetches raw Open Time roster data for a base.
   *
   * @param options - Required NOC base identifier.
   * @returns NOC Open Time roster payload unchanged.
   * @throws NocBrowserError when `baseId` is invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getOpenTimeRoster(options: NocOpenTimeBaseOptions): Promise<NocOpenTimeRosterResultRaw> {
    return getOpenTimeRoster(this, options);
  }

  /**
   * Fetches raw Open Time roster legality values for a base.
   *
   * @param options - Required NOC base identifier.
   * @returns NOC Open Time roster legality payload unchanged.
   * @throws NocBrowserError when `baseId` is invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getOpenTimeRosterLegalityValues(
    options: NocOpenTimeBaseOptions,
  ): Promise<NocOpenTimeRosterLegalityValuesResultRaw> {
    return getOpenTimeRosterLegalityValues(this, options);
  }

  /**
   * Fetches raw Open Time pairing data for a base.
   *
   * @param options - Required NOC base identifier.
   * @returns NOC Open Time pairings payload unchanged.
   * @throws NocBrowserError when `baseId` is invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getOpenTimePairings(
    options: NocOpenTimeBaseOptions,
  ): Promise<NocOpenTimePairingsResultRaw> {
    return getOpenTimePairings(this, options);
  }

  /**
   * Fetches raw Open Time pairing legality values for a base.
   *
   * @param options - Required NOC base identifier.
   * @returns NOC Open Time pairing legality payload unchanged.
   * @throws NocBrowserError when `baseId` is invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getOpenTimePairingsLegalityValues(
    options: NocOpenTimeBaseOptions,
  ): Promise<NocOpenTimePairingsLegalityValuesResultRaw> {
    return getOpenTimePairingsLegalityValues(this, options);
  }

  /**
   * Fetches raw block details for one Open Time pairing.
   *
   * @param pairingId - Positive NOC pairing identifier.
   * @returns NOC Open Time pairing block-details payload unchanged.
   * @throws NocBrowserError when `pairingId` is invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getOpenTimePairingsBlockDetails(
    pairingId: number,
  ): Promise<NocOpenTimePairingsBlockDetailsResultRaw> {
    return getOpenTimePairingsBlockDetails(this, pairingId);
  }

  /**
   * Fetches raw Net Reserve data.
   *
   * @param options - Optional SAP mode flag.
   * @returns NOC Net Reserve payload unchanged.
   * @throws NocBrowserError when options are invalid.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getNetReserve(options: NocNetReserveOptions = {}): Promise<NocNetReserveResultRaw> {
    return getNetReserve(this, options);
  }

  /**
   * Posts a Station Operations search and returns raw panels keyed by NOC label.
   *
   * @param options - Required date plus optional station, sort, time mode, and refresh behavior.
   * @returns Raw Station Operations rows preserving NOC field text.
   * @throws NocBrowserError when options are invalid or station code cannot be resolved.
   * @throws NocRevisionAckRequiredError when revision acknowledgement blocks the request.
   */
  async getStationOps(options: NocStationOpsOptions): Promise<NocStationOpsResultRaw> {
    return getStationOps(this.#stationOpsPage, options);
  }

  /**
   * Loads a fresh My Revision page and parses its raw page-shaped data.
   *
   * @returns Raw revision days and acknowledgement status.
   * @throws NocAuthenticationError when the session is not authenticated.
   * @throws NocBrowserError when NOC returns an unexpected page.
   */
  async getRevision(): Promise<NocRevisionResultRaw> {
    return this.#revisionPage.getRevision();
  }

  /**
   * Attempts to confirm active My Revision acknowledgement.
   *
   * @returns Raw confirmation status after the POST.
   * @throws NocAuthenticationError when the session is not authenticated.
   * @throws NocBrowserError when NOC returns an unexpected page.
   */
  async confirmRevision(): Promise<NocConfirmRevisionResultRaw> {
    return this.#revisionPage.confirmRevision();
  }

  /**
   * Checks whether My Revision currently requires acknowledgement.
   *
   * @returns `true` only when an enabled confirm control is present.
   * @throws NocAuthenticationError when the session is not authenticated.
   * @throws NocBrowserError when NOC returns an unexpected page.
   */
  async hasRevisionAckRequired(): Promise<boolean> {
    return this.#revisionPage.hasRevisionAckRequired();
  }
}
