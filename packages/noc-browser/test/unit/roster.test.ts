import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NocBrowser, NocBrowserError } from "../../src/index.js";
import type { FetchLike } from "../../src/types.js";

describe("Roster APIs", () => {
  it("posts exact Roster monthly accumulated values payload to the NOC WebMethod", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues":
          jsonResponse(
            "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues",
            { d: { AccumulatedValues: [] } },
          ),
      }),
    });

    await browser.getRosterMonthlyAccumulatedValues({ month: 3, year: 2026, hrId: 9227 });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues",
    );
    expect(calls[0]?.body).toBe(JSON.stringify({ month: 3, year: 2026, hrId: 9227 }));
  });

  it("returns the sample raw payload unchanged after ASP.NET d unwrapping", async () => {
    const sample = JSON.parse(
      readFileSync("../../samples/sample.getRosterMonthlyAccumulatedValues.json", "utf8"),
    ) as unknown;
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues":
          jsonResponse(
            "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues",
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
  });

  it("does not make hidden convenience calls for Roster monthly accumulated values", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues":
          jsonResponse(
            "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues",
            { d: { AccumulatedValues: [] } },
          ),
      }),
    });

    await browser.getRosterMonthlyAccumulatedValues({ month: 3, year: 2026, hrId: 9227 });

    expect(calls.map((call) => call.url)).toEqual([
      "https://poe.example.test/RaidoMobile/Dialogues/HumanResources/HumanResourceRoster.aspx/GetMonthlyAccumulatedValues",
    ]);
    expect(calls.some((call) => call.url.endsWith("/GetHumanResources"))).toBe(false);
    expect(calls.some((call) => call.url.endsWith("/GetRoster"))).toBe(false);
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
