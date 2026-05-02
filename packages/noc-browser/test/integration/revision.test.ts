import { describe, expect, it } from "vitest";
import { NocBrowser } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

describe("My Revision integration", () => {
  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "loads My Revision and checks acknowledgement status without confirming",
    async () => {
      const browser = new NocBrowser({
        baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
      });

      await browser.authenticate(process.env.NOC_USERNAME ?? "", process.env.NOC_PASSWORD ?? "");

      const revision = await browser.getRevision();
      const revisionAckRequired = await browser.hasRevisionAckRequired();

      expect(revision.currentUrl).toContain("HumanResourceMyRevision.aspx");
      expect(typeof revision.revisionAckRequired).toBe("boolean");
      expect(typeof revisionAckRequired).toBe("boolean");
      expect(revision.revisionAckRequired).toBe(revisionAckRequired);
      expect(Array.isArray(revision.days)).toBe(true);

      if (revision.revisionAckRequired) {
        expect(revision.revisionAckDetails?.confirmButtonPresent).toBe(true);
      }
    },
  );
});
