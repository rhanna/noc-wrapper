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

/**
 * Raw My Revision activity row preserving NOC activity and detail field text.
 */
export interface NocRevisionActivityRaw extends NocJsonObject {
  /** Activity header fields keyed by the NOC activity label text. */
  readonly Activity: NocJsonObject;
  /** Activity detail fields keyed by the NOC detail label text. */
  readonly ActivityDetails: NocJsonObject;
}

/**
 * Raw My Revision day parsed from one `.ListItem` section.
 */
export interface NocRevisionDayRaw {
  /** NOC day header text. */
  readonly date: string;
  /** Day-level NOC notes text. */
  readonly notes: readonly string[];
  /** Dynamic section arrays keyed by exact NOC section header text. */
  readonly [sectionHeader: string]: string | readonly string[] | readonly NocRevisionActivityRaw[];
}

/**
 * Raw My Revision page result.
 */
export interface NocRevisionResultRaw {
  /** Final NOC URL for the My Revision page. */
  readonly currentUrl: string;
  /** Whether an enabled revision confirm control is present. */
  readonly revisionAckRequired: boolean;
  /** Raw acknowledgement details when acknowledgement is required. */
  readonly revisionAckDetails?: NocRevisionAckDetailsRaw;
  /** Parsed raw revision days, preserving NOC section names and field text. */
  readonly days: readonly NocRevisionDayRaw[];
}

/**
 * Raw result returned after attempting to confirm My Revision.
 */
export interface NocConfirmRevisionResultRaw {
  /** Final NOC URL after the confirm attempt. */
  readonly currentUrl: string;
  /** Whether the confirm POST cleared the acknowledgement requirement. */
  readonly confirmed: boolean;
  /** Whether acknowledgement is still required after the call. */
  readonly revisionAckRequired: boolean;
  /** Raw acknowledgement details when acknowledgement remains required. */
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
  const activityLabels = $day
    .find("itemdetailslabels td")
    .toArray()
    .map((cell) => textFrom($(cell)));
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
    sectionRows.push(parseActivityHolder($, $element, activityLabels));
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
  activityLabels: readonly string[],
): NocRevisionActivityRaw {
  const activityValues = $holder
    .find(".ItemChildHeader td")
    .toArray()
    .map((cell) => textFrom($(cell)));

  return {
    Activity: mapHeadersToValues(activityLabels, activityValues),
    ActivityDetails: parseActivityDetails($, $holder),
  };
}

function parseActivityDetails(
  $: CheerioAPI,
  $holder: Cheerio<AnyNode>,
): Readonly<Record<string, string>> {
  const fields: Record<string, string> = {};
  const detailRows = $holder
    .find(".ItemChildDetails")
    .toArray()
    .flatMap((detailsElement) => {
      const $details = $(detailsElement);

      return $details.is("tr") ? [detailsElement] : $details.find("tr").toArray();
    });

  detailRows.forEach((detailRow) => {
    const cells = $(detailRow)
      .children("td")
      .toArray()
      .map((cell) => textFrom($(cell)));
    const label = cells[0];

    if (label) {
      fields[label] = cells[1] ?? "";
    }
  });

  return fields;
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
