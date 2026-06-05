import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NocBrowser, NocBrowserError, NocRevisionAckRequiredError } from "../../src/index.js";
import type { FetchLike } from "../../src/types.js";

const ROSTER_WEBMETHOD_BASE =
  "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx";
const CREW_ON_BOARD_WEBMETHOD_BASE =
  "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceCrewOnBoardDetails.aspx";

describe("Roster APIs", () => {
  it("posts exact getHumanResources payload", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${ROSTER_WEBMETHOD_BASE}/GetHumanResources`]: jsonResponse(
          `${ROSTER_WEBMETHOD_BASE}/GetHumanResources`,
          { d: { HumanResources: [] } },
        ),
      }),
    });

    await expect(browser.getHumanResources()).resolves.toEqual({ HumanResources: [] });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ROSTER_WEBMETHOD_BASE}/GetHumanResources`);
    expect(calls[0]?.body).toBe(JSON.stringify({}));
  });

  it("posts exact getCurrentUserInfo payload", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${ROSTER_WEBMETHOD_BASE}/GetCurrentUserInfo`]: jsonResponse(
          `${ROSTER_WEBMETHOD_BASE}/GetCurrentUserInfo`,
          { d: { Info: { CurrentUser: { Id: 9227 } } } },
        ),
      }),
    });

    await expect(browser.getCurrentUserInfo()).resolves.toEqual({
      Info: { CurrentUser: { Id: 9227 } },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ROSTER_WEBMETHOD_BASE}/GetCurrentUserInfo`);
    expect(calls[0]?.body).toBe(JSON.stringify({ hrId: -1 }));
  });

  it("posts exact getRoster payload and returns the sample raw payload", async () => {
    const calls: FetchCall[] = [];
    const sample = readJsonSample("sample.getRoster.json");
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${ROSTER_WEBMETHOD_BASE}/GetRoster`]: jsonResponse(
          `${ROSTER_WEBMETHOD_BASE}/GetRoster`,
          sample,
        ),
      }),
    });

    const result = await browser.getRoster({ month: 4, year: 2026, hrId: 9227 });

    expect(result).toEqual((sample as { d: unknown }).d);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ROSTER_WEBMETHOD_BASE}/GetRoster`);
    expect(calls[0]?.body).toBe(JSON.stringify({ month: 4, year: 2026, hrId: 9227 }));
  });

  it("does not make hidden convenience calls for getRoster", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${ROSTER_WEBMETHOD_BASE}/GetRoster`]: jsonResponse(`${ROSTER_WEBMETHOD_BASE}/GetRoster`, {
          d: { Roster: { Days: {} } },
        }),
      }),
    });

    await browser.getRoster({ month: 3, year: 2026, hrId: 9227 });

    expect(calls.map((call) => call.url)).toEqual([`${ROSTER_WEBMETHOD_BASE}/GetRoster`]);
    expect(calls.some((call) => call.url.endsWith("/GetHumanResources"))).toBe(false);
    expect(calls.some((call) => call.url.endsWith("/GetCurrentUserInfo"))).toBe(false);
  });

  it("posts exact getCrewOnBoardDetails payload and returns the sample raw payload", async () => {
    const calls: FetchCall[] = [];
    const sample = readJsonSample("sample.getCrewOnBoardDetails.json");
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${CREW_ON_BOARD_WEBMETHOD_BASE}/GetCrewOnBoardDetails`]: jsonResponse(
          `${CREW_ON_BOARD_WEBMETHOD_BASE}/GetCrewOnBoardDetails`,
          sample,
        ),
      }),
    });

    const result = await browser.getCrewOnBoardDetails(5576810);

    expect(result).toEqual((sample as { d: unknown }).d);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${CREW_ON_BOARD_WEBMETHOD_BASE}/GetCrewOnBoardDetails`);
    expect(calls[0]?.body).toBe(JSON.stringify({ activityId: 5576810 }));
  });

  it("posts exact Roster monthly accumulated values payload and returns sample raw payload", async () => {
    const calls: FetchCall[] = [];
    const sample = readJsonSample("sample.getRosterMonthlyAccumulatedValues.json");
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${ROSTER_WEBMETHOD_BASE}/GetMonthlyAccumulatedValues`]: jsonResponse(
          `${ROSTER_WEBMETHOD_BASE}/GetMonthlyAccumulatedValues`,
          sample,
        ),
      }),
    });

    await expect(
      browser.getRosterMonthlyAccumulatedValues({ month: 5, year: 2026, hrId: 9227 }),
    ).resolves.toEqual({
      AccumulatedValues: [
        {
          Label: "Credits (Bid Period)",
          Value: "01MAY26-31MAY26: 72:33",
        },
        {
          Label: "Monthly Duty",
          Value: "84:52",
        },
      ],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${ROSTER_WEBMETHOD_BASE}/GetMonthlyAccumulatedValues`);
    expect(calls[0]?.body).toBe(JSON.stringify({ month: 5, year: 2026, hrId: 9227 }));
  });

  it("does not make hidden convenience calls for Roster monthly accumulated values", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${ROSTER_WEBMETHOD_BASE}/GetMonthlyAccumulatedValues`]: jsonResponse(
          `${ROSTER_WEBMETHOD_BASE}/GetMonthlyAccumulatedValues`,
          { d: { AccumulatedValues: [] } },
        ),
      }),
    });

    await browser.getRosterMonthlyAccumulatedValues({ month: 3, year: 2026, hrId: 9227 });

    expect(calls.map((call) => call.url)).toEqual([
      `${ROSTER_WEBMETHOD_BASE}/GetMonthlyAccumulatedValues`,
    ]);
    expect(calls.some((call) => call.url.endsWith("/GetHumanResources"))).toBe(false);
    expect(calls.some((call) => call.url.endsWith("/GetRoster"))).toBe(false);
  });

  it("validates Roster arguments", async () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    await expect(browser.getRoster({ month: 0, year: 2026, hrId: 9227 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getRoster({ month: 13, year: 2026, hrId: 9227 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getRoster({ month: 3.5, year: 2026, hrId: 9227 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getRoster({ month: 3, year: 0, hrId: 9227 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getRoster({ month: 3, year: 2026, hrId: 0 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getCrewOnBoardDetails(0)).rejects.toBeInstanceOf(NocBrowserError);
    await expect(browser.getCrewOnBoardDetails(1.5)).rejects.toBeInstanceOf(NocBrowserError);
  });

  it("validates Roster monthly accumulated values arguments", async () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    await expect(
      browser.getRosterMonthlyAccumulatedValues({ month: 0, year: 2026, hrId: 9227 }),
    ).rejects.toBeInstanceOf(NocBrowserError);
    await expect(
      browser.getRosterMonthlyAccumulatedValues({ month: 13, year: 2026, hrId: 9227 }),
    ).rejects.toBeInstanceOf(NocBrowserError);
    await expect(
      browser.getRosterMonthlyAccumulatedValues({ month: 3.5, year: 2026, hrId: 9227 }),
    ).rejects.toBeInstanceOf(NocBrowserError);
    await expect(
      browser.getRosterMonthlyAccumulatedValues({ month: 3, year: 0, hrId: 9227 }),
    ).rejects.toBeInstanceOf(NocBrowserError);
    await expect(
      browser.getRosterMonthlyAccumulatedValues({ month: 3, year: 2026, hrId: 0 }),
    ).rejects.toBeInstanceOf(NocBrowserError);
  });

  it("throws revision acknowledgement error when a Roster WebMethod is blocked", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        [`${ROSTER_WEBMETHOD_BASE}/GetRoster`]: htmlResponse(
          `${ROSTER_WEBMETHOD_BASE}/GetRoster`,
          revisionAckHtml(),
        ),
      }),
    });

    await expect(browser.getRoster({ month: 3, year: 2026, hrId: 9227 })).rejects.toBeInstanceOf(
      NocRevisionAckRequiredError,
    );
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

function jsonResponse(url: string, json: unknown): Response {
  const response = new Response(JSON.stringify(json), {
    headers: {
      "Content-Type": "application/json",
    },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
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

function readJsonSample(filename: string): unknown {
  return JSON.parse(readFileSync(`../../samples/${filename}`, "utf8")) as unknown;
}

function revisionAckHtml(): string {
  return `
    <html>
      <body>
        <h1>My Revision</h1>
        <form method="post" action="HumanResourceMyRevision.aspx">
          <span id="MasterMain_lblMessage">Review and confirm your active revision.</span>
          <input
            id="MasterMain_btnConfirm"
            type="submit"
            name="ctl00$MasterMain$btnConfirm"
            value="Confirm"
          />
        </form>
      </body>
    </html>
  `;
}
