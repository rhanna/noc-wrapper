import { describe, expect, it } from "vitest";
import type {
  NocAuthenticationResultRaw,
  NocJsonObject,
  NocRevisionResultRaw,
  NocStationOpsResultRaw,
} from "../../src/index.js";

// @ts-expect-error noc-browser reserves unsuffixed Result names for noc-client.
import type { NocAuthenticationResult } from "../../src/index.js";
// @ts-expect-error noc-browser reserves unsuffixed Result names for noc-client.
import type { NocRevisionResult } from "../../src/index.js";
// @ts-expect-error noc-browser reserves unsuffixed Result names for noc-client.
import type { NocStationOpsResult } from "../../src/index.js";

describe("raw browser result exports", () => {
  it("exports raw result names and JSON boundary types", () => {
    const authentication = {
      authenticated: true,
      currentUrl: "https://poe.example.test/RaidoMobile/Home.aspx",
      revisionAckRequired: false,
    } satisfies NocAuthenticationResultRaw;

    const revision = {
      currentUrl:
        "https://poe.example.test/RaidoMobile/Grids/HumanResources/HumanResourceMyRevision.aspx",
      revisionAckRequired: false,
      days: [],
    } satisfies NocRevisionResultRaw;

    const stationOps = {
      Departures: [],
      Arrivals: [],
    } satisfies NocStationOpsResultRaw;

    const rawJson = {
      authentication,
      revision,
      stationOps,
    } satisfies NocJsonObject;

    expect(rawJson.authentication).toBe(authentication);
    expect(rawJson.revision).toBe(revision);
    expect(rawJson.stationOps).toBe(stationOps);
  });
});
