import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import {
  AbstractBrowser,
  AbstractBrowserPage,
  NocBrowser,
  NocBrowserPage,
  NocLoginPage,
  NocRevisionPage,
  type FetchLike,
} from "../../src/index.js";

describe("NocBrowserPage", () => {
  it("scrapes form actions including NOC rnd values", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          `
            <form method="post" action="Default.aspx?rnd=12345">
              <input type="hidden" name="__VIEWSTATE" value="state" />
            </form>
          `,
        ),
      }),
    });

    const page = await new NocBrowserPage(browser, "/Default.aspx").load();

    expect(calls[0]?.url).toBe("https://poe.example.test/RaidoMobile/Default.aspx");
    expect(page.formAction).toBe("https://poe.example.test/RaidoMobile/Default.aspx?rnd=12345");
  });

  it("preserves hidden fields when posting overrides", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          `
            <form method="post" action="Default.aspx?rnd=login">
              <input type="hidden" name="__VIEWSTATE" value="state" />
              <input type="hidden" name="__EVENTVALIDATION" value="validation" />
            </form>
          `,
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=login": htmlResponse(
          "https://poe.example.test/RaidoMobile/Home.aspx",
          '<form action="Home.aspx"></form>',
        ),
      }),
    });

    const page = await new NocBrowserPage(browser, "/Default.aspx").load();
    await page.post({ ctl00$MasterMain$btnSub: "Login" });

    const postBody = calls[1]?.body;
    expect(postBody).toBeInstanceOf(URLSearchParams);
    const formBody = postBody as URLSearchParams;
    expect(formBody.get("__VIEWSTATE")).toBe("state");
    expect(formBody.get("__EVENTVALIDATION")).toBe("validation");
    expect(formBody.get("ctl00$MasterMain$btnSub")).toBe("Login");
  });

  it("extracts select, textarea, checkbox, and radio form fields", () => {
    const $ = load(`
      <form>
        <select name="base">
          <option value="YYZ">Toronto</option>
          <option value="YVR" selected>Vancouver</option>
        </select>
        <textarea name="notes">Line one</textarea>
        <input type="checkbox" name="save" checked />
        <input type="checkbox" name="skip" />
        <input type="radio" name="mode" value="local" checked />
        <input type="radio" name="mode" value="utc" />
      </form>
    `);

    expect(NocBrowserPage.extractFormFields($("form"))).toEqual({
      base: "YVR",
      notes: "Line one",
      save: "on",
      mode: "local",
    });
  });

  it("resolves relative form actions against the current page URL", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Dialogues/Page.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Dialogues/Page.aspx",
          '<form action="../Default.aspx?rnd=abc"></form>',
        ),
      }),
    });

    const page = await new NocBrowserPage(browser, "/Dialogues/Page.aspx").load();

    expect(page.formAction).toBe("https://poe.example.test/RaidoMobile/Default.aspx?rnd=abc");
  });
});

describe("NocBrowser", () => {
  it("owns one login page and one revision page instance", () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    expect(browser.loginPage).toBeInstanceOf(NocLoginPage);
    expect(browser.revisionPage).toBeInstanceOf(NocRevisionPage);
    expect(browser.loginPage).toBe(browser.loginPage);
    expect(browser.revisionPage).toBe(browser.revisionPage);
  });

  it("unwraps ASP.NET WebMethod responses shaped as d", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Service.aspx/Method": jsonResponse(
          "https://poe.example.test/RaidoMobile/Service.aspx/Method",
          { d: { value: 42 } },
        ),
      }),
    });

    await expect(browser.postWebMethod("/Service.aspx/Method", {})).resolves.toEqual({
      value: 42,
    });

    expect(calls[0]?.body?.toString()).toBe("{}");
  });

  it("merges HeadersInit overrides without dropping tuple or Headers values", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Service.aspx/Method": jsonResponse(
          "https://poe.example.test/RaidoMobile/Service.aspx/Method",
          { d: true },
        ),
        "https://poe.example.test/RaidoMobile/api/value": jsonResponse(
          "https://poe.example.test/RaidoMobile/api/value",
          { ok: true },
        ),
      }),
    });

    await browser.postWebMethod("/Service.aspx/Method", {}, [
      ["Accept", "application/vnd.noc+json"],
      ["X-NOC-Token", "tuple-token"],
    ]);
    await browser.getJsonApi("/api/value", new Headers({ "X-NOC-Token": "headers-token" }));

    expect(headerValue(calls[0]?.init?.headers, "accept")).toBe("application/vnd.noc+json");
    expect(headerValue(calls[0]?.init?.headers, "content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(headerValue(calls[0]?.init?.headers, "x-noc-token")).toBe("tuple-token");
    expect(headerValue(calls[1]?.init?.headers, "accept")).toBe("application/json");
    expect(headerValue(calls[1]?.init?.headers, "x-noc-token")).toBe("headers-token");
  });
});

describe("abstract classes", () => {
  it("cannot instantiate the abstract browser client directly", () => {
    expect(() => {
      // @ts-expect-error verifies the direct constructor call is rejected by TypeScript.
      new AbstractBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });
    }).toThrow("AbstractBrowser cannot be instantiated directly");
  });

  it("cannot instantiate the abstract page directly", () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    expect(() => {
      // @ts-expect-error verifies the direct constructor call is rejected by TypeScript.
      new AbstractBrowserPage(browser, "/Default.aspx");
    }).toThrow("AbstractBrowserPage cannot be instantiated directly");
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

    return response;
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
  return responseWithUrl(url, html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

function jsonResponse(url: string, json: unknown): Response {
  return responseWithUrl(url, JSON.stringify(json), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function responseWithUrl(url: string, body: BodyInit, init: ResponseInit): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function headerValue(headers: HeadersInit | undefined, name: string): string | null {
  return new Headers(headers).get(name);
}
