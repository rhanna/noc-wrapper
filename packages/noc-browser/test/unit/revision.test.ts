import { describe, expect, it } from "vitest";
import { NocBrowser, parseRevisionDays, type FetchLike } from "../../src/index.js";

describe("Revision parsing", () => {
  it("parses revision days into date, revision, current, and activity fields", () => {
    const days = parseRevisionDays(revisionPageHtml());

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "01 Jan 2026",
      notes: ["Day note"],
    });
    expect(days[0]?.activities).toHaveLength(2);
    expect(days[0]?.revision[0]).toMatchObject({
      section: "revision",
      sectionHeader: "Revision",
      headers: ["Pairing", "Report", "Release"],
      values: ["AC123", "08:00", "16:45"],
      fields: {
        Pairing: "AC123",
        Report: "08:00",
        Release: "16:45",
      },
      notes: ["Revision note"],
    });
    expect(days[0]?.current[0]).toMatchObject({
      section: "current",
      sectionHeader: "Current",
      fields: {
        Pairing: "RSV",
        Report: "09:00",
        Release: "17:00",
      },
    });
  });

  it("maps New to revision and Previous or Old to current", () => {
    const days = parseRevisionDays(`
      <div class="ListItem">
        <div class="ItemDayHeader">02 Jan 2026</div>
        <div class="ItemDetailsHeader">New</div>
        ${activityHolder("Pairing", "NEW1")}
        <div class="ItemDetailsHeader">Previous</div>
        ${activityHolder("Pairing", "OLD1")}
        <div class="ItemDetailsHeader">Old</div>
        ${activityHolder("Pairing", "OLD2")}
      </div>
    `);

    expect(days[0]?.revision.map((activity) => activity.fields.Pairing)).toEqual(["NEW1"]);
    expect(days[0]?.current.map((activity) => activity.fields.Pairing)).toEqual(["OLD1", "OLD2"]);
  });
});

describe("NocRevisionPage APIs", () => {
  it("loads Revision fresh for each getRevision call", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml(),
          ),
      }),
    });

    await browser.getRevision();
    await browser.getRevision();

    expect(calls.map((call) => call.url)).toEqual([
      "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
      "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
    ]);
  });

  it("detects revision acknowledgement from page content", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml({ confirmButton: true }),
          ),
      }),
    });

    await expect(browser.hasRevisionAckRequired()).resolves.toBe(true);
  });

  it("posts the exact confirm field and preserves hidden form state", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml({
              action: "HumanResourceMyRevision.aspx?rnd=confirm",
              confirmButton: true,
            }),
          ),
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx?rnd=confirm":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml(),
          ),
      }),
    });

    await expect(browser.confirmRevision()).resolves.toEqual({
      currentUrl:
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
      confirmed: true,
      revisionAckRequired: false,
      revisionAckDetails: undefined,
    });

    const postBody = calls[1]?.body;
    expect(postBody).toBeInstanceOf(URLSearchParams);
    const fields = Object.fromEntries((postBody as URLSearchParams).entries());
    expect(fields).toMatchObject({
      __VIEWSTATE: "state",
      __EVENTVALIDATION: "validation",
      ctl00$MasterMain$btnConfirm: "Confirm",
    });
  });

  it("reports still-required acknowledgement after confirm when the confirm form remains", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml({
              action: "HumanResourceMyRevision.aspx?rnd=confirm",
              confirmButton: true,
            }),
          ),
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx?rnd=confirm":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml({ confirmButton: true }),
          ),
      }),
    });

    await expect(browser.confirmRevision()).resolves.toMatchObject({
      confirmed: false,
      revisionAckRequired: true,
      revisionAckDetails: {
        currentUrl:
          "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
        title: "My Revision",
        message: "Review and confirm your active revision.",
        confirmButtonPresent: true,
      },
    });
  });
});

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
  readonly body: URLSearchParams | string | undefined;
}

function createFetch(calls: FetchCall[], responses: Record<string, Response>): FetchLike {
  return async (input, init) => {
    const url = input.toString();
    calls.push({
      url,
      init,
      body: readBody(init?.body),
    });

    const response = responses[url];

    if (!response) {
      throw new Error(`Unexpected URL: ${url}`);
    }

    const responseClone = response.clone();
    Object.defineProperty(responseClone, "url", { value: response.url });
    return responseClone;
  };
}

function readBody(body: BodyInit | null | undefined): URLSearchParams | string | undefined {
  if (body instanceof URLSearchParams) {
    return body;
  }

  if (typeof body === "string") {
    return body;
  }

  return undefined;
}

function htmlResponse(url: string, html: string): Response {
  const response = new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function revisionPageHtml({
  action = "HumanResourceMyRevision.aspx",
  confirmButton = false,
}: {
  readonly action?: string;
  readonly confirmButton?: boolean;
} = {}): string {
  return `
    <html>
      <body>
        <h1>My Revision</h1>
        <form method="post" action="${action}">
          <input type="hidden" name="__VIEWSTATE" value="state" />
          <input type="hidden" name="__EVENTVALIDATION" value="validation" />
          <span id="MasterMain_lblMessage">Review and confirm your active revision.</span>
          ${confirmButton ? '<input id="MasterMain_btnConfirm" type="submit" name="ctl00$MasterMain$btnConfirm" value="Confirm" />' : ""}
          <div class="ListItem">
            <div class="ItemDayHeader">01 Jan 2026</div>
            <div class="ItemDetailsHeader">Revision</div>
            ${activityHolder("Pairing Report Release", "AC123 08:00 16:45", "Revision note")}
            <div class="ItemDetailsHeader">Current</div>
            ${activityHolder("Pairing Report Release", "RSV 09:00 17:00")}
            <div class="ItemNotes">Day note</div>
          </div>
        </form>
      </body>
    </html>
  `;
}

function activityHolder(headerText: string, detailText: string, notes = ""): string {
  const headers = headerText
    .split(" ")
    .map((header) => `<td>${header}</td>`)
    .join("");
  const values = detailText
    .split(" ")
    .map((value) => `<td>${value}</td>`)
    .join("");

  return `
    <div class="ItemChildHolder">
      <table>
        <tr class="ItemChildHeader">${headers}</tr>
        <tr class="ItemChildDetails">${values}</tr>
      </table>
      ${notes ? `<div class="ItemNotes">${notes}</div>` : ""}
    </div>
  `;
}
