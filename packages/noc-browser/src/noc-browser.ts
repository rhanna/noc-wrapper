import { AbstractBrowser } from "./lib/browser/abstract-browser.js";
import { authenticate } from "./noc-auth.js";
import { type NocAuthenticationResult } from "./types.js";
import {
  getRosterMonthlyAccumulatedValues,
  type NocRosterMonthlyAccumulatedValuesOptions,
  type NocRosterMonthlyAccumulatedValuesResult,
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
  constructor(options: BrowserOptions) {
    super(options);
  }

  async authenticate(username: string, password: string): Promise<NocAuthenticationResult> {
    return authenticate(this, username, password);
  }

  async getRosterMonthlyAccumulatedValues(
    options: NocRosterMonthlyAccumulatedValuesOptions,
  ): Promise<NocRosterMonthlyAccumulatedValuesResult> {
    return getRosterMonthlyAccumulatedValues(this, options);
  }

  async getRevision(): Promise<NocRevisionResult> {
    return new NocRevisionPage(this).getRevision();
  }

  async confirmRevision(): Promise<NocConfirmRevisionResult> {
    return new NocRevisionPage(this).confirmRevision();
  }

  async hasRevisionAckRequired(): Promise<boolean> {
    return new NocRevisionPage(this).hasRevisionAckRequired();
  }
}
