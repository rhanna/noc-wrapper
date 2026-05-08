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
  type RevisionAckDetails,
} from "./noc-revision-ack.js";
import type { NocBrowser } from "./noc-browser.js";

const CONFIRM_REVISION_FIELD = "ctl00$MasterMain$btnConfirm";

export type NocRevisionSection = "revision" | "current";

export interface NocRevisionActivity {
  readonly section?: NocRevisionSection;
  readonly sectionHeader?: string;
  readonly headers: readonly string[];
  readonly values: readonly string[];
  readonly fields: Readonly<Record<string, string>>;
  readonly notes: readonly string[];
}

export interface NocRevisionDay {
  readonly date: string;
  readonly revision: readonly NocRevisionActivity[];
  readonly current: readonly NocRevisionActivity[];
  readonly activities: readonly NocRevisionActivity[];
  readonly notes: readonly string[];
}

export interface NocRevisionResult {
  readonly currentUrl: string;
  readonly revisionAckRequired: boolean;
  readonly revisionAckDetails?: RevisionAckDetails;
  readonly days: readonly NocRevisionDay[];
}

export interface NocConfirmRevisionResult {
  readonly currentUrl: string;
  readonly confirmed: boolean;
  readonly revisionAckRequired: boolean;
  readonly revisionAckDetails?: RevisionAckDetails;
}

export class NocRevisionPage extends NocBrowserPage {
  constructor(browser: NocBrowser) {
    super(browser, REVISION_PATH);
  }

  async getRevision(): Promise<NocRevisionResult> {
    await this.load({ refresh: true });
    this.assertLoadedRevisionPage();
    return this.toRevisionResult();
  }

  async hasRevisionAckRequired(): Promise<boolean> {
    await this.load({ refresh: true });
    this.assertLoadedRevisionPage();
    return hasRevisionAckRequiredHtml(this.html);
  }

  async confirmRevision(): Promise<NocConfirmRevisionResult> {
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

  private toRevisionResult(): NocRevisionResult {
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

export function parseRevisionDays(html: string): readonly NocRevisionDay[] {
  const $ = load(html);

  return $(".ListItem")
    .toArray()
    .map((dayElement) => parseRevisionDay($, $(dayElement)));
}

function parseRevisionDay($: CheerioAPI, $day: Cheerio<AnyNode>): NocRevisionDay {
  const date = textFrom($day.find(".ItemDayHeader").first());
  const revision: NocRevisionActivity[] = [];
  const current: NocRevisionActivity[] = [];
  const activities: NocRevisionActivity[] = [];
  const notes = $day
    .children(".ItemNotes")
    .toArray()
    .map((noteElement) => textFrom($(noteElement)))
    .filter(Boolean);

  let activeSection: NocRevisionSection | undefined;
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
  section: NocRevisionSection | undefined,
  sectionHeader: string | undefined,
): readonly NocRevisionActivity[] {
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

function mapRevisionSection(header: string | undefined): NocRevisionSection | undefined {
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
