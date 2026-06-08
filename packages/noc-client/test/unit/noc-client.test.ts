import { describe, expect, it, vi } from "vitest";
import type { NocBrowser, NocBrowserOptions } from "@rhanna/noc-browser";
import { NocClient } from "../../src/index.js";

describe("NocClient", () => {
  it("accepts an injected NocBrowser", async () => {
    const authenticate = vi.fn().mockResolvedValue({
      authenticated: true,
      currentUrl: "https://poe.example.test/RaidoMobile/Home.aspx",
      revisionAckRequired: false,
    });
    const browser = { authenticate } as unknown as NocBrowser;
    const client = new NocClient({ browser });

    await expect(client.authenticate("11538", "ActualPassword123")).resolves.toEqual({
      authenticated: true,
      revisionAckRequired: false,
    });
    expect(authenticate).toHaveBeenCalledWith("11538", "ActualPassword123");
  });

  it("accepts browserOptions and constructs a browser", async () => {
    const browserOptions: NocBrowserOptions = {
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch({
        "https://poe.example.test/RaidoMobile/Default.aspx": htmlResponse(
          "https://poe.example.test/RaidoMobile/Default.aspx",
          loginPageHtml("Default.aspx?rnd=9619"),
        ),
        "https://poe.example.test/RaidoMobile/Default.aspx?rnd=9619": htmlResponse(
          "https://poe.example.test/RaidoMobile/Home.aspx",
          "<html><body>Home</body></html>",
        ),
      }),
    };
    const client = new NocClient({ browserOptions });

    await expect(client.authenticate("11538", "ActualPassword123")).resolves.toEqual({
      authenticated: true,
      revisionAckRequired: false,
    });
  });

  it("rejects both browser and browserOptions", () => {
    const browser = createBrowserMock();
    const browserOptions = { baseUrl: "https://poe.example.test/RaidoMobile" };

    expect(
      () =>
        new NocClient({ browser, browserOptions } as unknown as ConstructorParameters<
          typeof NocClient
        >[0]),
    ).toThrow(TypeError);
  });

  it("rejects neither browser nor browserOptions", () => {
    expect(() => new NocClient({} as ConstructorParameters<typeof NocClient>[0])).toThrow(
      TypeError,
    );
  });

  it("maps successful browser auth without exposing raw browser details", async () => {
    const browser = createBrowserMock({
      authenticated: true,
      currentUrl: "https://poe.example.test/RaidoMobile/Home.aspx",
      revisionAckRequired: false,
    });
    const client = new NocClient({ browser });

    const result = await client.authenticate("11538", "ActualPassword123");

    expect(result).toEqual({
      authenticated: true,
      revisionAckRequired: false,
    });
    expect(result).not.toHaveProperty("currentUrl");
    expect(result).not.toHaveProperty("revisionAckDetails");
  });

  it("maps revision-required browser auth without exposing acknowledgement details", async () => {
    const browser = createBrowserMock({
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
    const client = new NocClient({ browser });

    const result = await client.authenticate("11538", "ActualPassword123");

    expect(result).toEqual({
      authenticated: true,
      revisionAckRequired: true,
    });
    expect(result).not.toHaveProperty("currentUrl");
    expect(result).not.toHaveProperty("revisionAckDetails");
  });

  it("passes browser authentication errors through unchanged", async () => {
    const error = new Error("authentication failed");
    const browser = createBrowserMock(error);
    const client = new NocClient({ browser });

    await expect(client.authenticate("bad-user", "bad-password")).rejects.toBe(error);
  });
});

function createBrowserMock(
  authResult: Awaited<ReturnType<NocBrowser["authenticate"]>> | Error = {
    authenticated: true,
    currentUrl: "https://poe.example.test/RaidoMobile/Home.aspx",
    revisionAckRequired: false,
  },
): NocBrowser {
  const authenticate =
    authResult instanceof Error
      ? vi.fn().mockRejectedValue(authResult)
      : vi.fn().mockResolvedValue(authResult);

  return { authenticate } as unknown as NocBrowser;
}

function createFetch(responses: Record<string, Response>): NonNullable<NocBrowserOptions["fetch"]> {
  return async (input) => {
    const response = responses[input.toString()];

    if (!response) {
      throw new Error(`Unexpected URL: ${input.toString()}`);
    }

    return response;
  };
}

function htmlResponse(url: string, html: string): Response {
  const response = new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function loginPageHtml(postAction: string): string {
  return `<!doctype html>
<html>
  <body>
    <form action="${postAction}">
      <input type="hidden" name="__VIEWSTATE" value="state" />
      <input type="hidden" name="__VIEWSTATEGENERATOR" value="generator" />
      <input type="hidden" name="__EVENTVALIDATION" value="validation" />
      <input name="ctl00$MasterMain$txtUserName" />
      <input name="ctl00$MasterMain$txtPassword" />
      <input name="ctl00$MasterMain$btnSub" />
    </form>
  </body>
</html>`;
}
