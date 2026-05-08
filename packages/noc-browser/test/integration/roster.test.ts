import { describe, expect, it } from "vitest";
import { NocBrowser } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";
const ROSTER_CURRENT_USER_INFO_PATH =
  "/Dialogues/HumanResources/HumanResourceRoster.aspx/GetCurrentUserInfo";

interface CurrentUserInfo {
  readonly HrId?: unknown;
  readonly Date?: unknown;
}

describe("Roster integration", () => {
  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "fetches Roster monthly accumulated values for the current user",
    async () => {
      const browser = new NocBrowser({
        baseUrl: process.env.NOC_BASE_URL ?? DEFAULT_BASE_URL,
      });

      const authResult = await browser.authenticate(
        process.env.NOC_USERNAME ?? "",
        process.env.NOC_PASSWORD ?? "",
      );

      if (authResult.revisionAckRequired) {
        expect(authResult.revisionAckDetails?.confirmButtonPresent).toBe(true);
        return;
      }

      const currentUser = await browser.postWebMethod<CurrentUserInfo>(
        ROSTER_CURRENT_USER_INFO_PATH,
        {},
      );
      const hrId = currentUser.HrId;
      const rosterDate =
        typeof currentUser.Date === "string" ? new Date(currentUser.Date) : new Date();

      expect(typeof hrId).toBe("number");
      expect(Number.isInteger(hrId)).toBe(true);

      const result = await browser.getRosterMonthlyAccumulatedValues({
        month: rosterDate.getUTCMonth() + 1,
        year: rosterDate.getUTCFullYear(),
        hrId: hrId as number,
      });

      expect(result).toBeTypeOf("object");

      if (result.AccumulatedValues !== undefined) {
        expect(Array.isArray(result.AccumulatedValues)).toBe(true);
      }
    },
  );
});
