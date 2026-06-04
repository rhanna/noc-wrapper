import { load } from "cheerio";
import { NocAuthenticationError } from "./errors.js";
import { NocBrowserPage } from "./noc-browser-page.js";
import {
  hasRevisionAckRequiredHtml,
  parseRevisionAckDetails,
  type RevisionAckDetails,
} from "./noc-revision-ack.js";
import type { NocBrowser } from "./noc-browser.js";
import { isDefaultPageUrl, isRevisionRequiredPage, LOGIN_PATH } from "./lib/noc-url-utils.js";
import { firstText } from "./lib/noc-parse-utils.js";

export interface NocAuthenticationResult {
  readonly authenticated: true;
  readonly currentUrl: string;
  readonly revisionAckRequired: boolean;
  readonly revisionAckDetails?: RevisionAckDetails;
}

export async function authenticate(
  browser: NocBrowser,
  username: string,
  password: string,
): Promise<NocAuthenticationResult> {
  if (!username) {
    throw new NocAuthenticationError("NOC username is required");
  }

  if (!password) {
    throw new NocAuthenticationError("NOC password is required");
  }

  const page = await new NocBrowserPage(browser, LOGIN_PATH).load({ refresh: true });

  await page.post({
    ctl00$MasterMain$txtUserName: username,
    ctl00$MasterMain$txtPassword: password,
    ctl00$MasterMain$languageid: "1",
    ctl00$MasterMain$cbSave: "on",
    ctl00$MasterMain$btnSub: "Login",
  });

  if (isFailedLogin(page.html, page.currentUrl)) {
    const loginErrorMessage = parseLoginErrorMessage(page.html);
    throw new NocAuthenticationError(
      loginErrorMessage
        ? `NOC authentication failed: ${loginErrorMessage}`
        : "NOC authentication failed",
      loginErrorMessage,
    );
  }

  if (isRevisionRequiredPage(page.currentUrl) && hasRevisionAckRequiredHtml(page.html)) {
    return {
      authenticated: true,
      currentUrl: page.currentUrl,
      revisionAckRequired: true,
      revisionAckDetails: parseRevisionAckDetails(page.html, page.currentUrl),
    };
  }

  return {
    authenticated: true,
    currentUrl: page.currentUrl,
    revisionAckRequired: false,
  };
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
