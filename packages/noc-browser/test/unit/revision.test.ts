import { describe, expect, it } from "vitest";
import { NocAuthenticationError, NocBrowser, NocBrowserError } from "../../src/index.js";
import { hasRevisionAckRequiredHtml, parseRevisionAckDetails } from "../../src/noc-revision-ack.js";
import { parseRevisionDays } from "../../src/noc-revision-page.js";
import type { FetchLike } from "../../src/types.js";

describe("Revision parsing", () => {
  it("parses revision days into date, literal NOC sections, and field rows", () => {
    const days = parseRevisionDays(revisionPageHtml());

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "01 Jan 2026",
      notes: ["Day note"],
    });
    expect(days[0]?.Revision).toEqual([
      {
        Pairing: "AC123",
        Report: "08:00",
        Release: "16:45",
      },
    ]);
    expect(days[0]?.Current).toEqual([
      {
        Pairing: "RSV",
        Report: "09:00",
        Release: "17:00",
      },
    ]);
  });

  it("keeps New, Previous, and Old as literal section keys", () => {
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

    expect(days[0]?.New).toEqual([{ Pairing: "NEW1" }]);
    expect(days[0]?.Previous).toEqual([{ Pairing: "OLD1" }]);
    expect(days[0]?.Old).toEqual([{ Pairing: "OLD2" }]);
    expect(days[0]).not.toHaveProperty("revision");
    expect(days[0]).not.toHaveProperty("current");
  });

  it("appends rows when a section header repeats", () => {
    const days = parseRevisionDays(`
      <div class="ListItem">
        <div class="ItemDayHeader">03 Jan 2026</div>
        <div class="ItemDetailsHeader">Revision</div>
        ${activityHolder("Pairing", "REV1")}
        <div class="ItemDetailsHeader">Revision</div>
        ${activityHolder("Pairing", "REV2")}
      </div>
    `);

    expect(days[0]?.Revision).toEqual([{ Pairing: "REV1" }, { Pairing: "REV2" }]);
  });

  it("uses an empty string section key for holders before any section header", () => {
    const days = parseRevisionDays(`
      <div class="ListItem">
        <div class="ItemDayHeader">04 Jan 2026</div>
        ${activityHolder("Pairing", "UNSECTIONED")}
      </div>
    `);

    expect(days[0]?.[""]).toEqual([{ Pairing: "UNSECTIONED" }]);
  });

  it("emits row fields only without legacy activity properties", () => {
    const days = parseRevisionDays(revisionPageHtml());
    const row = Array.isArray(days[0]?.Revision) ? days[0]?.Revision[0] : undefined;

    expect(row).toEqual({
      Pairing: "AC123",
      Report: "08:00",
      Release: "16:45",
    });
    expect(row).not.toHaveProperty("section");
    expect(row).not.toHaveProperty("sectionHeader");
    expect(row).not.toHaveProperty("headers");
    expect(row).not.toHaveProperty("values");
    expect(row).not.toHaveProperty("fields");
    expect(row).not.toHaveProperty("notes");
    expect(days[0]).not.toHaveProperty("activities");
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

  it("does not require revision acknowledgement for a disabled confirm control", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml({
              confirmButton: true,
              confirmButtonDisabled: true,
              confirmButtonValue: "No revisions to confirm",
            }),
          ),
      }),
    });

    await expect(browser.hasRevisionAckRequired()).resolves.toBe(false);
  });

  it("rejects My Revision loads that are redirected to the login page", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse("https://poe.example.test/RaidoMobile/Default.aspx", loginPageHtml()),
      }),
    });

    await expect(browser.getRevision()).rejects.toBeInstanceOf(NocAuthenticationError);
  });

  it("rejects My Revision loads that land on an unexpected authenticated page", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Home.aspx",
            "<html><body>Home</body></html>",
          ),
      }),
    });

    await expect(browser.getRevision()).rejects.toBeInstanceOf(NocBrowserError);
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

  it("does not report confirm success when confirmation redirects to login", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx":
          htmlResponse(
            "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
            revisionPageHtml({
              action: "HumanResourceMyRevision.aspx?rnd=expired",
              confirmButton: true,
            }),
          ),
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx?rnd=expired":
          htmlResponse("https://poe.example.test/RaidoMobile/Default.aspx", loginPageHtml()),
      }),
    });

    await expect(browser.confirmRevision()).rejects.toBeInstanceOf(NocAuthenticationError);
  });
});

describe("Revision acknowledgement detection", () => {
  it("detects an enabled confirm button as acknowledgement-required", () => {
    const html = revisionPageHtml({ confirmButton: true });

    expect(hasRevisionAckRequiredHtml(html)).toBe(true);
    expect(parseRevisionAckDetails(html, "https://poe.example.test/revision")).toMatchObject({
      confirmButtonPresent: true,
    });
  });

  it("ignores disabled confirm controls", () => {
    const html = revisionPageHtml({
      confirmButton: true,
      confirmButtonDisabled: true,
      confirmButtonValue: "No revisions to confirm",
    });

    expect(hasRevisionAckRequiredHtml(html)).toBe(false);
    expect(parseRevisionAckDetails(html, "https://poe.example.test/revision")).toMatchObject({
      confirmButtonPresent: false,
    });
  });

  it("ignores confirm controls with a bare disabled attribute", () => {
    expect(
      hasRevisionAckRequiredHtml(`
        <input
          id="MasterMain_btnConfirm"
          name="ctl00$MasterMain$btnConfirm"
          value="No revisions to confirm"
          disabled
        />
      `),
    ).toBe(false);
  });

  it("does not require acknowledgement for an empty My Revision page", () => {
    expect(
      hasRevisionAckRequiredHtml("<html><body><h1>My Revision</h1><form></form></body></html>"),
    ).toBe(false);
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
  confirmButtonDisabled = false,
  confirmButtonValue = "Confirm",
}: {
  readonly action?: string;
  readonly confirmButton?: boolean;
  readonly confirmButtonDisabled?: boolean;
  readonly confirmButtonValue?: string;
} = {}): string {
  return `
    <html>
      <body>
        <h1>My Revision</h1>
        <form method="post" action="${action}">
          <input type="hidden" name="__VIEWSTATE" value="state" />
          <input type="hidden" name="__EVENTVALIDATION" value="validation" />
          <span id="MasterMain_lblMessage">Review and confirm your active revision.</span>
          ${
            confirmButton
              ? `<input id="MasterMain_btnConfirm" type="submit" name="ctl00$MasterMain$btnConfirm" value="${confirmButtonValue}" ${confirmButtonDisabled ? 'disabled="disabled"' : ""} />`
              : ""
          }
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

function loginPageHtml(): string {
  return `
    <html>
      <body>
        <form method="post" action="Default.aspx?rnd=login">
          <input name="ctl00$MasterMain$txtUserName" value="" />
          <input name="ctl00$MasterMain$txtPassword" value="" />
          <input type="submit" name="ctl00$MasterMain$btnSub" value="Login" />
        </form>
      </body>
    </html>
  `;
}
