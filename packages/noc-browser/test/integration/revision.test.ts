import { describe, expect, it } from "vitest";
import {
  NocBrowser,
  type NocRevisionActivityRaw,
  type NocRevisionDayRaw,
} from "../../src/index.js";

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

      const changedDays = revision.days.filter((day) => getRevisionSections(day).length > 0);
      expect(changedDays.length).toBeGreaterThan(0);

      const firstChangedDay = changedDays[0];
      const firstSection = firstChangedDay ? getRevisionSections(firstChangedDay)[0] : undefined;
      const firstActivity = firstSection?.rows[0];

      expect(firstChangedDay?.date).toEqual(expect.any(String));
      expect(firstChangedDay?.date.length).toBeGreaterThan(0);
      expect(firstSection?.header).toEqual(expect.any(String));
      expect(firstSection?.rows.length).toBeGreaterThan(0);
      expect(Object.keys(firstActivity?.Activity ?? {}).length).toBeGreaterThan(0);
      expect(Object.keys(firstActivity?.ActivityDetails ?? {}).length).toBeGreaterThan(0);

      if (revision.revisionAckRequired) {
        expect(revision.revisionAckDetails?.confirmButtonPresent).toBe(true);
      }
    },
  );
});

function getRevisionSections(
  day: NocRevisionDayRaw,
): readonly { readonly header: string; readonly rows: readonly NocRevisionActivityRaw[] }[] {
  const sections: { readonly header: string; readonly rows: readonly NocRevisionActivityRaw[] }[] =
    [];

  for (const [header, value] of Object.entries(day)) {
    if (header !== "date" && header !== "notes" && isActivityRows(value)) {
      sections.push({ header, rows: value });
    }
  }

  return sections;
}

function isActivityRows(value: unknown): value is readonly NocRevisionActivityRaw[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        !Array.isArray(row) &&
        typeof row.Activity === "object" &&
        row.Activity !== null &&
        typeof row.ActivityDetails === "object" &&
        row.ActivityDetails !== null,
    )
  );
}
