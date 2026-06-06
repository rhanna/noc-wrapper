import { load } from "cheerio";
import { firstText } from "./lib/noc-parse-utils.js";

const CONFIRM_BUTTON_SELECTOR = '#MasterMain_btnConfirm, input[name="ctl00$MasterMain$btnConfirm"]';

export interface NocRevisionAckDetailsRaw {
  readonly currentUrl: string;
  readonly title?: string;
  readonly message?: string;
  readonly confirmButtonPresent: boolean;
}

export function hasRevisionAckRequiredHtml(html: string): boolean {
  const $ = load(html);
  return hasActionableConfirmButton($);
}

export function parseRevisionAckDetails(
  html: string,
  currentUrl: string,
): NocRevisionAckDetailsRaw {
  const $ = load(html);
  const title = firstText($, "h1, h2, .Title, .PageTitle, #MasterMain_lblTitle");
  const message = firstText(
    $,
    [
      "#MasterMain_lblMessage",
      "#MasterMain_lblInfo",
      "#MasterMain_lblDescription",
      ".InfoMessage",
      ".Message",
      ".ItemNotes",
    ].join(", "),
  );

  return {
    currentUrl,
    title,
    message,
    confirmButtonPresent: hasActionableConfirmButton($),
  };
}

function hasActionableConfirmButton($: ReturnType<typeof load>): boolean {
  return $(CONFIRM_BUTTON_SELECTOR)
    .toArray()
    .some((element) => $(element).attr("disabled") === undefined);
}
