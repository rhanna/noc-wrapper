import { load } from "cheerio";
import { NocAuthenticationError } from "./errors.js";
import { NocBrowserPage } from "./noc-browser-page.js";
import {
  hasRevisionAckRequiredHtml,
  parseRevisionAckDetails,
  type NocRevisionAckDetailsRaw,
} from "./noc-revision-ack.js";
import type { NocBrowser } from "./noc-browser.js";
import { isDefaultPageUrl, isRevisionRequiredPage, LOGIN_PATH } from "./lib/noc-url-utils.js";
import { firstText } from "./lib/noc-parse-utils.js";

export interface NocAuthenticationResultRaw {
  /** Always `true` when authentication succeeds. */
  readonly authenticated: true;
  /** Final NOC URL after the login POST completes. */
  readonly currentUrl: string;
  /** Whether login succeeded but active revision acknowledgement is required. */
  readonly revisionAckRequired: boolean;
  /** Raw revision acknowledgement details when acknowledgement is required. */
  readonly revisionAckDetails?: NocRevisionAckDetailsRaw;
}

export class NocLoginPage extends NocBrowserPage {
  constructor(browser: NocBrowser) {
    super(browser, LOGIN_PATH);
  }

  async authenticate(username: string, password: string): Promise<NocAuthenticationResultRaw> {
    if (!username) {
      throw new NocAuthenticationError("NOC username is required");
    }

    if (!password) {
      throw new NocAuthenticationError("NOC password is required");
    }

    await this.load({ refresh: true });

    await this.post({
      ctl00$MasterMain$txtUserName: username,
      ctl00$MasterMain$txtPassword: password,
      ctl00$MasterMain$languageid: "1",
      ctl00$MasterMain$cbSave: "on",
      ctl00$MasterMain$btnSub: "Login",
    });

    if (isFailedLogin(this.html, this.currentUrl)) {
      const loginErrorMessage = parseLoginErrorMessage(this.html);
      throw new NocAuthenticationError(
        loginErrorMessage
          ? `NOC authentication failed: ${loginErrorMessage}`
          : "NOC authentication failed",
        loginErrorMessage,
      );
    }

    if (isRevisionRequiredPage(this.currentUrl) && hasRevisionAckRequiredHtml(this.html)) {
      return {
        authenticated: true,
        currentUrl: this.currentUrl,
        revisionAckRequired: true,
        revisionAckDetails: parseRevisionAckDetails(this.html, this.currentUrl),
      };
    }

    return {
      authenticated: true,
      currentUrl: this.currentUrl,
      revisionAckRequired: false,
    };
  }
}

export function isLoginFormPresent(html: string): boolean {
  const $ = load(html);
  return (
    $('input[name="ctl00$MasterMain$txtUserName"]').length > 0 &&
    $('input[name="ctl00$MasterMain$txtPassword"]').length > 0 &&
    $('input[name="ctl00$MasterMain$btnSub"]').length > 0
  );
}

export function parseLoginErrorMessage(html: string): string | undefined {
  const $ = load(html);
  const selector = [
    "#MasterMain_lblError",
    "#MasterMain_lblMessage",
    "#MasterMain_lblLoginError",
    '[id$="lblError"]',
    '[id$="lblMessage"]',
    '[id*="Error"]',
    ".validation-summary-errors",
    ".error",
    ".Error",
  ].join(", ");
  const explicitMessage = firstText($, selector);

  if (explicitMessage) {
    return explicitMessage;
  }

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const loginErrorMatch = bodyText.match(
    /(?:invalid|incorrect|failed|locked|disabled|expired)[^.。!?]*(?:[.。!?]|$)/i,
  );

  return loginErrorMatch?.[0]?.trim() || undefined;
}

function isFailedLogin(html: string, currentUrl: string): boolean {
  return isDefaultPageUrl(currentUrl) || isLoginFormPresent(html);
}
