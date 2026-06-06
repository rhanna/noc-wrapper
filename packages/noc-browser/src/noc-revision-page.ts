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

const CONFIRM_REVISION_FIELD = "ctl00$MasterMain$btnConfirm";

export type NocRevisionSectionRaw = "revision" | "current";

export interface NocRevisionActivityRaw {
  readonly section?: NocRevisionSectionRaw;
  readonly sectionHeader?: string;
  readonly headers: readonly string[];
  readonly values: readonly string[];
  readonly fields: Readonly<Record<string, string>>;
  readonly notes: readonly string[];
}

export interface NocRevisionDayRaw {
  readonly date: string;
  readonly revision: readonly NocRevisionActivityRaw[];
  readonly current: readonly NocRevisionActivityRaw[];
  readonly activities: readonly NocRevisionActivityRaw[];
  readonly notes: readonly string[];
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
  const revision: NocRevisionActivityRaw[] = [];
  const current: NocRevisionActivityRaw[] = [];
  const activities: NocRevisionActivityRaw[] = [];
  const notes = $day
    .children(".ItemNotes")
    .toArray()
    .map((noteElement) => textFrom($(noteElement)))
    .filter(Boolean);

  let activeSection: NocRevisionSectionRaw | undefined;
  let activeSectionHeader: string | undefined;

  $day.find(".ItemDetailsHeader, .ItemChildHolder").each((_, element) => {
    const $element = $(element);

    if ($element.hasClass("ItemDetailsHeader")) {
      activeSectionHeader = textFrom($element);
      activeSection = mapRevisionSection(activeSectionHeader);
      return;
    }

    if (!$element.hasClass("ItemChildHolder")) {
      return;
    }

    const parsedActivities = parseActivityHolder($, $element, activeSection, activeSectionHeader);

    for (const activity of parsedActivities) {
      activities.push(activity);

      if (activity.section === "revision") {
        revision.push(activity);
      } else if (activity.section === "current") {
        current.push(activity);
      }
    }
  });

  return {
    date,
    revision,
    current,
    activities,
    notes,
  };
}

function parseActivityHolder(
  $: CheerioAPI,
  $holder: Cheerio<AnyNode>,
  section: NocRevisionSectionRaw | undefined,
  sectionHeader: string | undefined,
): readonly NocRevisionActivityRaw[] {
  const headers = $holder
    .find(".ItemChildHeader td")
    .toArray()
    .map((cell) => textFrom($(cell)));
  const details = $holder.find(".ItemChildDetails");
  const notes = $holder
    .find(".ItemNotes")
    .toArray()
    .map((noteElement) => textFrom($(noteElement)))
    .filter(Boolean);

  if (details.length === 0) {
    return [
      {
        section,
        sectionHeader,
        headers,
        values: [],
        fields: {},
        notes,
      },
    ];
  }

  return details.toArray().map((detailRow) => {
    const values = $(detailRow)
      .find("td")
      .toArray()
      .map((cell) => textFrom($(cell)));

    return {
      section,
      sectionHeader,
      headers,
      values,
      fields: mapHeadersToValues(headers, values),
      notes,
    };
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

function mapRevisionSection(header: string | undefined): NocRevisionSectionRaw | undefined {
  if (!header) {
    return undefined;
  }

  if (/\b(revision|new)\b/i.test(header)) {
    return "revision";
  }

  if (/\b(current|previous|old)\b/i.test(header)) {
    return "current";
  }

  return undefined;
}
