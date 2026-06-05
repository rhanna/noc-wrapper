import { describe, expect, it } from "vitest";
import { NocBrowser } from "../../src/index.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

describe("Roster integration", () => {
  it.runIf(process.env.NOC_USERNAME && process.env.NOC_PASSWORD)(
    "fetches current user, human resources, roster, accumulated values, and crew details when available",
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

      const currentUser = await browser.getCurrentUserInfo();
      const hrId = getCurrentUserHrId(currentUser);
      const rosterDate = getCurrentUserRosterDate(currentUser);

      expect(Number.isInteger(hrId)).toBe(true);

      const humanResources = await browser.getHumanResources();
      expect(humanResources).toBeTypeOf("object");

      const roster = await browser.getRoster({
        month: rosterDate.getUTCMonth() + 1,
        year: rosterDate.getUTCFullYear(),
        hrId,
      });
      expect(roster).toBeTypeOf("object");

      const monthlyAccumulatedValues = await browser.getRosterMonthlyAccumulatedValues({
        month: rosterDate.getUTCMonth() + 1,
        year: rosterDate.getUTCFullYear(),
        hrId,
      });
      expect(monthlyAccumulatedValues).toBeTypeOf("object");

      const activityId = findFirstActivityId(roster);

      if (activityId !== undefined) {
        const crewDetails = await browser.getCrewOnBoardDetails(activityId);
        expect(crewDetails).toBeTypeOf("object");
      }
    },
  );
});

function getCurrentUserHrId(currentUser: Record<string, unknown>): number {
  const info = currentUser.Info;
  const currentUserInfo =
    typeof info === "object" && info !== null && !Array.isArray(info)
      ? (info as Record<string, unknown>).CurrentUser
      : undefined;
  const nestedId =
    typeof currentUserInfo === "object" &&
    currentUserInfo !== null &&
    !Array.isArray(currentUserInfo)
      ? (currentUserInfo as Record<string, unknown>).Id
      : undefined;
  const hrId = nestedId ?? currentUser.hrId ?? currentUser.HrId;

  if (typeof hrId !== "number" || !Number.isInteger(hrId)) {
    throw new Error("Live current user response did not include a numeric Roster hrId");
  }

  return hrId;
}

function getCurrentUserRosterDate(currentUser: Record<string, unknown>): Date {
  const value = currentUser.date ?? currentUser.Date;
  const date = typeof value === "string" ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function findFirstActivityId(value: unknown): number | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const activityId = findFirstActivityId(item);

      if (activityId !== undefined) {
        return activityId;
      }
    }

    return undefined;
  }

  const object = value as Record<string, unknown>;

  if (typeof object.Id === "number" && Number.isInteger(object.Id) && object.Id > 0) {
    return object.Id;
  }

  for (const child of Object.values(object)) {
    const activityId = findFirstActivityId(child);

    if (activityId !== undefined) {
      return activityId;
    }
  }

  return undefined;
}
