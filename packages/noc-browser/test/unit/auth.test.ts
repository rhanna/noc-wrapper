import { describe, expect, it } from "vitest";
import {
  NocAuthenticationError,
  NocBrowser,
  NocRevisionAckRequiredError,
  type FetchLike,
} from "../../src/index.js";

describe("NocBrowser authentication", () => {
  it("posts exact NOC authentication fields with scraped hidden fields", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          loginPageHtml("Default.aspx?rnd=9619"),
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=9619": htmlResponse(
          "https://poe.example.test/RaidoMobile/Home.aspx",
          "<html><body>Home</body></html>",
        ),
      }),
    });

    await expect(browser.authenticate("11538", "ActualPassword123")).resolves.toEqual({
      authenticated: true,
      currentUrl: "https://poe.example.test/RaidoMobile/Home.aspx",
      revisionAckRequired: false,
    });

    const postBody = calls[1]?.body;
    expect(postBody).toBeInstanceOf(URLSearchParams);
    const fields = Object.fromEntries((postBody as URLSearchParams).entries());
    expect(fields).toMatchObject({
      __VIEWSTATE: "state",
      __VIEWSTATEGENERATOR: "generator",
      __EVENTVALIDATION: "validation",
      ctl00$MasterMain$fBrwWidth: "",
      ctl00$MasterMain$fBrwHeight: "",
      ctl00$MasterMain$fActualHeight: "",
      ctl00$MasterMain$encPassword: "",
      ctl00$MasterMain$txtUserName: "11538",
      ctl00$MasterMain$txtPassword: "ActualPassword123",
      ctl00$MasterMain$languageid: "1",
      ctl00$MasterMain$cbSave: "on",
      ctl00$MasterMain$btnSub: "Login",
    });
  });

  it("throws auth error when login form remains on Default.aspx and exposes parsed error text", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          loginPageHtml("Default.aspx?rnd=bad"),
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=bad": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx?rnd=bad",
          loginPageHtml("Default.aspx?rnd=bad", "Invalid user name or password."),
        ),
      }),
    });

    await expect(browser.authenticate("bad-user", "bad-password")).rejects.toMatchObject({
      name: "NocAuthenticationError",
      loginErrorMessage: "Invalid user name or password.",
    });
  });

  it("throws auth error when Default.aspx returns without the expected login form", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          loginPageHtml("Default.aspx?rnd=ambiguous"),
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=ambiguous": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx?rnd=ambiguous",
          "<html><body><h1>Password change required</h1></body></html>",
        ),
      }),
    });

    await expect(browser.authenticate("user", "password")).rejects.toMatchObject({
      name: "NocAuthenticationError",
      message: "NOC authentication failed",
    });
  });

  it("returns revisionAckRequired when authentication lands on active revision acknowledgement", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          loginPageHtml("Default.aspx?rnd=ack"),
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=ack": htmlResponse(
          "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
          revisionAckHtml(),
        ),
      }),
    });

    await expect(browser.authenticate("11538", "ActualPassword123")).resolves.toEqual({
      authenticated: true,
      currentUrl:
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
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

  it("does not treat an empty My Revision page as revisionAckRequired", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], {
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          loginPageHtml("Default.aspx?rnd=empty-revision"),
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=empty-revision": htmlResponse(
          "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
          "<html><body><h1>My Revision</h1><form></form></body></html>",
        ),
      }),
    });

    await expect(browser.authenticate("11538", "ActualPassword123")).resolves.toMatchObject({
      authenticated: true,
      revisionAckRequired: false,
    });
  });

  it("exports revision acknowledgement error with required naming", () => {
    const error = new NocRevisionAckRequiredError("RevisionAckRequired");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NocRevisionAckRequiredError");
  });

  it("requires username and password", async () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    await expect(browser.authenticate("", "password")).rejects.toBeInstanceOf(
      NocAuthenticationError,
    );
    await expect(browser.authenticate("username", "")).rejects.toBeInstanceOf(
      NocAuthenticationError,
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
  const response = new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function loginPageHtml(action: string, errorMessage = ""): string {
  return `
    <html>
      <body>
        <form method="post" action="${action}">
          <input type="hidden" name="__VIEWSTATE" value="state" />
          <input type="hidden" name="__VIEWSTATEGENERATOR" value="generator" />
          <input type="hidden" name="__EVENTVALIDATION" value="validation" />
          <input name="ctl00$MasterMain$fBrwWidth" value="" />
          <input name="ctl00$MasterMain$fBrwHeight" value="" />
          <input name="ctl00$MasterMain$fActualHeight" value="" />
          <input name="ctl00$MasterMain$encPassword" value="" />
          <input name="ctl00$MasterMain$txtUserName" value="" />
          <input name="ctl00$MasterMain$txtPassword" value="" />
          <input name="ctl00$MasterMain$languageid" value="1" />
          <input type="checkbox" name="ctl00$MasterMain$cbSave" checked />
          <input type="submit" name="ctl00$MasterMain$btnSub" value="Login" />
          <span id="MasterMain_lblError">${errorMessage}</span>
        </form>
      </body>
    </html>
  `;
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
