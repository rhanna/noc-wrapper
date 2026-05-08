import { NocBrowser } from "./noc-browser.js";

export { AbstractBrowser } from "./lib/browser/abstract-browser.js";
export { AbstractBrowserPage } from "./lib/browser/abstract-browser-page.js";
export type { PageLoadOptions } from "./lib/browser/abstract-browser-page.js";
export { NocBrowser };
export { NocBrowserPage } from "./noc-browser-page.js";
export { NocRevisionPage, parseRevisionDays } from "./noc-revision-page.js";
export {
  NocAuthenticationError,
  NocBrowserError,
  NocHttpError,
  NocJsonError,
  NocRevisionAckRequiredError,
} from "./errors.js";
export type { NocAuthenticationResult as AuthenticationResult } from "./noc-auth.js";
export type {
  NocRosterMonthlyAccumulatedValue,
  NocRosterMonthlyAccumulatedValuesOptions,
  NocRosterMonthlyAccumulatedValuesResult,
} from "./noc-roster.js";
export type { RevisionAckDetails } from "./noc-revision-ack.js";
export type {
  NocConfirmRevisionResult,
  NocRevisionResult,
  NocRevisionActivity,
  NocRevisionDay,
  NocRevisionSection,
} from "./noc-revision-page.js";
export type {
  FetchLike,
  FormFields,
  HtmlResponse,
  JsonObject,
  BrowserOptions as NocBrowserOptions,
} from "./types.js";

export default NocBrowser;
