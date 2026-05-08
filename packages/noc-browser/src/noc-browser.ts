import { AbstractBrowser } from "./lib/browser/abstract-browser.js";
import { authenticate, type NocAuthenticationResult } from "./noc-auth.js";
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
