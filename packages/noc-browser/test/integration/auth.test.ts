import { describe, expect, it } from "vitest";
import { NocAuthenticationError, NocBrowser } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

describe("authentication", () => {
  it("rejects invalid credentials with an authentication error", async () => {
    const browser = new NocBrowser({
      baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
    });

    await expect(
      browser.authenticate(`codex-invalid-${Date.now()}`, "codex-invalid-password"),
    ).rejects.toBeInstanceOf(NocAuthenticationError);
  });

  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "authenticates valid credentials and reports revision acknowledgement state",
    async () => {
      const browser = new NocBrowser({
        baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
      });

      const result = await browser.authenticate(
        process.env.NOC_USERNAME ?? "",
        process.env.NOC_PASSWORD ?? "",
      );

      expect(result.authenticated).toBe(true);
      expect(typeof result.revisionAckRequired).toBe("boolean");

      if (result.revisionAckRequired) {
        expect(result.revisionAckDetails?.confirmButtonPresent).toBe(true);
      }
    },
  );
});
