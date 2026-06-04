import { describe, expect, it } from "vitest";
import { NocBrowser } from "../../src/index.js";
import { NocBrowserPage } from "../../src/noc-browser-page.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

describe("Default.aspx smoke", () => {
  it("loads the login page and parses form action and hidden fields", async () => {
    const browser = new NocBrowser({
      baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
    });

    const page = await new NocBrowserPage(browser, "/Default.aspx").load({ refresh: true });

    expect(page.html).toContain("form");
    expect(page.formAction).toContain("Default.aspx");
    expect(page.formAction).toContain("rnd=");
    expect(Object.keys(page.fields)).toContain("__VIEWSTATE");
  });
});
