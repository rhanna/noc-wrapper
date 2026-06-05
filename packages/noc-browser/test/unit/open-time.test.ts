import { describe, expect, it } from "vitest";
import { NocBrowser, NocBrowserError, NocRevisionAckRequiredError } from "../../src/index.js";
import type { FetchLike } from "../../src/types.js";

const OPEN_TIME_API_BASE = "https://poe.example.test/RaidoMobile/api/open-time";

describe("Open Time APIs", () => {
  it("gets user context from the exact Open Time URL and returns raw JSON", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/user-context`]: jsonResponse(`${OPEN_TIME_API_BASE}/user-context`, {
          bases: [{ id: 1035, name: "YTZ", default: true }],
        }),
      }),
    });

    await expect(browser.getOpenTimeUserContext()).resolves.toEqual({
      bases: [{ id: 1035, name: "YTZ", default: true }],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${OPEN_TIME_API_BASE}/user-context`);
  });

  it("gets Open Time roster without hidden legality calls", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/rosters/1?baseId=1035`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/rosters/1?baseId=1035`,
          { results: [{ id: 5576810 }] },
        ),
      }),
    });

    await expect(browser.getOpenTimeRoster({ baseId: 1035 })).resolves.toEqual({
      results: [{ id: 5576810 }],
    });

    expect(calls.map((call) => call.url)).toEqual([`${OPEN_TIME_API_BASE}/rosters/1?baseId=1035`]);
  });

  it("gets Open Time roster legality values only from the explicit legality method", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/rosters/1/legality?baseId=1035`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/rosters/1/legality?baseId=1035`,
          { results: [{ id: 239932, legalityValues: [{ key: "BLH", value: "05:30" }] }] },
        ),
      }),
    });

    await expect(browser.getOpenTimeRosterLegalityValues({ baseId: 1035 })).resolves.toEqual({
      results: [{ id: 239932, legalityValues: [{ key: "BLH", value: "05:30" }] }],
    });

    expect(calls.map((call) => call.url)).toEqual([
      `${OPEN_TIME_API_BASE}/rosters/1/legality?baseId=1035`,
    ]);
  });

  it("gets Open Time pairings without hidden legality or block-detail calls", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/rosters/2?baseId=1035`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/rosters/2?baseId=1035`,
          { results: [{ id: 245884, isPairing: true }] },
        ),
      }),
    });

    await expect(browser.getOpenTimePairings({ baseId: 1035 })).resolves.toEqual({
      results: [{ id: 245884, isPairing: true }],
    });

    expect(calls.map((call) => call.url)).toEqual([`${OPEN_TIME_API_BASE}/rosters/2?baseId=1035`]);
  });

  it("gets Open Time pairings legality values only from the explicit legality method", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/rosters/2/legality?baseId=1035`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/rosters/2/legality?baseId=1035`,
          { results: [{ id: 247902, legalityValues: [{ key: "FDP", value: "05:12" }] }] },
        ),
      }),
    });

    await expect(browser.getOpenTimePairingsLegalityValues({ baseId: 1035 })).resolves.toEqual({
      results: [{ id: 247902, legalityValues: [{ key: "FDP", value: "05:12" }] }],
    });

    expect(calls.map((call) => call.url)).toEqual([
      `${OPEN_TIME_API_BASE}/rosters/2/legality?baseId=1035`,
    ]);
  });

  it("gets Open Time pairings block details only from the explicit block-details method", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/rosters/2/block-details/245884`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/rosters/2/block-details/245884`,
          { results: [{ assignedPairingId: 245884, activityCode: "P32949" }] },
        ),
      }),
    });

    await expect(browser.getOpenTimePairingsBlockDetails(245884)).resolves.toEqual({
      results: [{ assignedPairingId: 245884, activityCode: "P32949" }],
    });

    expect(calls.map((call) => call.url)).toEqual([
      `${OPEN_TIME_API_BASE}/rosters/2/block-details/245884`,
    ]);
  });

  it("gets Net Reserve with default and explicit isSap query values", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        [`${OPEN_TIME_API_BASE}/net-reserve?isSap=false`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/net-reserve?isSap=false`,
          { results: [{ grids: [] }] },
        ),
        [`${OPEN_TIME_API_BASE}/net-reserve?isSap=true`]: jsonResponse(
          `${OPEN_TIME_API_BASE}/net-reserve?isSap=true`,
          { results: [{ sap: true }] },
        ),
      }),
    });

    await expect(browser.getNetReserve()).resolves.toEqual({ results: [{ grids: [] }] });
    await expect(browser.getNetReserve({ isSap: false })).resolves.toEqual({
      results: [{ grids: [] }],
    });
    await expect(browser.getNetReserve({ isSap: true })).resolves.toEqual({
      results: [{ sap: true }],
    });

    expect(calls.map((call) => call.url)).toEqual([
      `${OPEN_TIME_API_BASE}/net-reserve?isSap=false`,
      `${OPEN_TIME_API_BASE}/net-reserve?isSap=false`,
      `${OPEN_TIME_API_BASE}/net-reserve?isSap=true`,
    ]);
  });

  it("validates Open Time arguments", async () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    await expect(browser.getOpenTimeRoster({ baseId: 0 })).rejects.toBeInstanceOf(NocBrowserError);
    await expect(browser.getOpenTimeRoster({ baseId: 1.5 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getOpenTimeRosterLegalityValues({ baseId: 0 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getOpenTimePairings({ baseId: 0 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getOpenTimePairingsLegalityValues({ baseId: 0 })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getOpenTimePairingsBlockDetails(0)).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getOpenTimePairingsBlockDetails(1.5)).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(
      browser.getNetReserve({ isSap: "false" as unknown as boolean }),
    ).rejects.toBeInstanceOf(NocBrowserError);
  });

  it("throws revision acknowledgement error when an Open Time JSON API is blocked", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        [`${OPEN_TIME_API_BASE}/rosters/1?baseId=1035`]: htmlResponse(
          `${OPEN_TIME_API_BASE}/rosters/1?baseId=1035`,
          revisionAckHtml(),
        ),
      }),
    });

    await expect(browser.getOpenTimeRoster({ baseId: 1035 })).rejects.toBeInstanceOf(
      NocRevisionAckRequiredError,
    );
  });
});

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function createFetch(calls: FetchCall[], responses: Record<string, Response>): FetchLike {
  return async (input, init) => {
    const url = input.toString();
    calls.push({ url, init });

    const response = responses[url];

    if (!response) {
      throw new Error(`Unexpected URL: ${url}`);
    }

    const responseClone = response.clone();
    Object.defineProperty(responseClone, "url", { value: response.url });
    return responseClone;
  };
}

function jsonResponse(url: string, body: unknown): Response {
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function htmlResponse(url: string, body: string): Response {
  const response = new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function revisionAckHtml(): string {
  return `
    <!doctype html>
    <html>
      <body>
        <form id="form">
          <div id="MasterMain_pnlRevision">
            <input type="submit" id="MasterMain_btnConfirm" name="ctl00$MasterMain$btnConfirm" value="Confirm" />
          </div>
        </form>
      </body>
    </html>
  `;
}
