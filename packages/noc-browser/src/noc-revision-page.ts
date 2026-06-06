import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { NocAuthenticationError, NocBrowserError } from "./errors.js";
import { REVISION_PATH, isDefaultPageUrl, isRevisionRequiredPage } from "./lib/noc-url-utils.js";
import { textFrom } from "./lib/noc-parse-utils.js";
import { isLoginFormPresent } from "./noc-auth.js";
import { NocBrowserPage } from "./noc-browser-page.js";
import {
  hasRevisionAckRequiredHtml,
  parseRevisionAckDetails,
  type NocRevisionAckDetailsRaw,
} from "./noc-revision-ack.js";
import type { NocBrowser } from "./noc-browser.js";
import type { NocJsonObject } from "./types.js";

const CONFIRM_REVISION_FIELD = "ctl00$MasterMain$btnConfirm";

export type NocRevisionActivityRaw = NocJsonObject;

export interface NocRevisionDayRaw {
  readonly date: string;
  readonly notes: readonly string[];
  readonly [sectionHeader: string]: string | readonly string[] | readonly NocRevisionActivityRaw[];
}

export interface NocRevisionResultRaw {
  readonly currentUrl: string;
  readonly revisionAckRequired: boolean;
  readonly revisionAckDetails?: NocRevisionAckDetailsRaw;
  readonly days: readonly NocRevisionDayRaw[];
}

export interface NocConfirmRevisionResultRaw {
  readonly currentUrl: string;
  readonly confirmed: boolean;
  readonly revisionAckRequired: boolean;
  readonly revisionAckDetails?: NocRevisionAckDetailsRaw;
}

export class NocRevisionPage extends NocBrowserPage {
  constructor(browser: NocBrowser) {
    super(browser, REVISION_PATH);
  }

  async getRevision(): Promise<NocRevisionResultRaw> {
    await this.load({ refresh: true });
    this.assertLoadedRevisionPage();
    return this.toRevisionResult();
  }

  async hasRevisionAckRequired(): Promise<boolean> {
    await this.load({ refresh: true });
    this.assertLoadedRevisionPage();
    return hasRevisionAckRequiredHtml(this.html);
  }

  async confirmRevision(): Promise<NocConfirmRevisionResultRaw> {
    await this.load({ refresh: true });
    this.assertLoadedRevisionPage();

    if (!hasRevisionAckRequiredHtml(this.html)) {
      return {
        currentUrl: this.currentUrl,
        confirmed: false,
        revisionAckRequired: false,
      };
    }

    await this.post({
      [CONFIRM_REVISION_FIELD]: "Confirm",
    });

    // After POST, assertLoadedRevisionPage checks if the response redirected to a login page
    this.assertLoadedRevisionPage();

    const revisionAckRequired = hasRevisionAckRequiredHtml(this.html);

    return {
      currentUrl: this.currentUrl,
      confirmed: !revisionAckRequired,
      revisionAckRequired,
      revisionAckDetails: revisionAckRequired
        ? parseRevisionAckDetails(this.html, this.currentUrl)
        : undefined,
    };
  }

  private toRevisionResult(): NocRevisionResultRaw {
    const revisionAckRequired = hasRevisionAckRequiredHtml(this.html);

    return {
      currentUrl: this.currentUrl,
      revisionAckRequired,
      revisionAckDetails: revisionAckRequired
        ? parseRevisionAckDetails(this.html, this.currentUrl)
        : undefined,
      days: parseRevisionDays(this.html),
    };
  }

  private assertLoadedRevisionPage(): void {
    if (isDefaultPageUrl(this.currentUrl) || isLoginFormPresent(this.html)) {
      throw new NocAuthenticationError(
        "NOC session is not authenticated; login page returned while loading My Revision",
      );
    }

    if (!isRevisionRequiredPage(this.currentUrl)) {
      throw new NocBrowserError(
        `NOC returned an unexpected page while loading My Revision: ${this.currentUrl}`,
      );
    }
  }
}

export function parseRevisionDays(html: string): readonly NocRevisionDayRaw[] {
  const $ = load(html);

  return $(".ListItem")
    .toArray()
    .map((dayElement) => parseRevisionDay($, $(dayElement)));
}

function parseRevisionDay($: CheerioAPI, $day: Cheerio<AnyNode>): NocRevisionDayRaw {
  const date = textFrom($day.find(".ItemDayHeader").first());
  const sections: Record<string, NocRevisionActivityRaw[]> = {};
  const notes = $day
    .children(".ItemNotes")
    .toArray()
    .map((noteElement) => textFrom($(noteElement)))
    .filter(Boolean);

  let activeSectionHeader = "";

  $day.find(".ItemDetailsHeader, .ItemChildHolder").each((_, element) => {
    const $element = $(element);

    if ($element.hasClass("ItemDetailsHeader")) {
      activeSectionHeader = textFrom($element);
      return;
    }

    if (!$element.hasClass("ItemChildHolder")) {
      return;
    }

    const sectionRows = sections[activeSectionHeader] ?? [];
    sectionRows.push(...parseActivityHolder($, $element));
    sections[activeSectionHeader] = sectionRows;
  });

  return {
    ...sections,
    date,
    notes,
  };
}

function parseActivityHolder(
  $: CheerioAPI,
  $holder: Cheerio<AnyNode>,
): readonly NocRevisionActivityRaw[] {
  const headers = $holder
    .find(".ItemChildHeader td")
    .toArray()
    .map((cell) => textFrom($(cell)));
  const details = $holder.find(".ItemChildDetails");

  if (details.length === 0) {
    return [mapHeadersToValues(headers, [])];
  }

  return details.toArray().map((detailRow) => {
    const values = $(detailRow)
      .find("td")
      .toArray()
      .map((cell) => textFrom($(cell)));

    return mapHeadersToValues(headers, values);
  });
}

function mapHeadersToValues(
  headers: readonly string[],
  values: readonly string[],
): Readonly<Record<string, string>> {
  return headers.reduce<Record<string, string>>((fields, header, index) => {
    if (header) {
      fields[header] = values[index] ?? "";
    }

    return fields;
  }, {});
}
