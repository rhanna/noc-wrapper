import { describe, expect, it } from "vitest";
import {
  NocBrowser,
  NocBrowserError,
  NocRevisionAckRequiredError,
  StationOpsSort,
  StationOpsTimeMode,
} from "../../src/index.js";
import type { FetchLike } from "../../src/types.js";

const STATION_OPS_URL =
  "https://poe.example.test/RaidoMobile/Dialogues/Operations/StationOperations.aspx";

describe("Station Ops APIs", () => {
  it("exports enum values used by the NOC form", () => {
    expect(StationOpsSort.Time).toBe(0);
    expect(StationOpsSort.Station).toBe(1);
    expect(StationOpsTimeMode.UTC).toBe(1);
    expect(StationOpsTimeMode.Local).toBe(2);
  });

  it("posts exact Station Ops fields and parses structured departures and arrivals", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, [
        htmlResponse(STATION_OPS_URL, stationOpsFormHtml()),
        htmlResponse(`${STATION_OPS_URL}?rnd=9650`, stationOpsResultsHtml()),
      ]),
    });

    const result = await browser.getStationOps({
      date: "2026-04-28",
      stationId: 11069,
      sort: StationOpsSort.Station,
      timeMode: StationOpsTimeMode.UTC,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe(STATION_OPS_URL);
    expect(calls[1]?.url).toBe(`${STATION_OPS_URL}?rnd=9650`);

    const postedFields = expectUrlSearchParams(calls[1]?.body);
    expect(postedFields.get("ctl00$MasterMain$tbDate$DateFieldTextBox")).toBe("28APR26");
    expect(postedFields.get("ctl00$MasterMain$tbDate$hfDate")).toBe("20260428");
    expect(postedFields.get("ctl00$MasterMain$ddlStation")).toBe("11069");
    expect(postedFields.get("ctl00$MasterMain$ddlSort")).toBe("1");
    expect(postedFields.get("ctl00$MasterMain$TimeMode$DP_TimeModes")).toBe("1");
    expect(postedFields.get("ctl00$MasterMain$btnSearch")).toBe("Search");

    expect(result.departuresLabel).toBe("Departures");
    expect(result.arrivalsLabel).toBe("Arrivals");
    expect(result.departures).toHaveLength(1);
    expect(result.arrivals).toHaveLength(1);
    expect(result.departures[0]?.header).toEqual({
      flightNum: "P32459",
      STD: "0645",
      ATD: "0649",
      dest: "YUL",
      registration: "C-GKQB",
      gate: "10",
      pax: "B 21",
      color: "#2AA843",
      raw: ["P32459", "0645", "0649", "YUL", "C-GKQB", "10", "", "B 21", "", ""],
    });
    expect(result.departures[0]?.details).toEqual({
      date: "28APR26",
      departure: "YTZ - CYTZ - TORONTO ISLAND APT",
      arrival: "YUL - CYUL - PIERRE ELLIOT TRUDEAU INTL",
      STD: "0645",
      STA: "0800",
      registration: "C-GKQB",
      version: "DH4XX",
      type: "DH4",
      depGate: "10",
      arrGate: undefined,
      crewOnBoard: "CA - 4488 Montesano, Joshua",
      delay: "Late aircraft",
      pax: "Bookings Weight 14/6/1/0",
      notes: "Ops note",
      raw: [
        { label: "Date", value: "28APR26" },
        { label: "Departure", value: "YTZ - CYTZ - TORONTO ISLAND APT" },
        { label: "Arrival", value: "YUL - CYUL - PIERRE ELLIOT TRUDEAU INTL" },
        { label: "STD", value: "0645" },
        { label: "STA", value: "0800" },
        { label: "Registration", value: "C-GKQB" },
        { label: "Version", value: "DH4XX" },
        { label: "Type", value: "DH4" },
        { label: "Dep Gate", value: "10" },
        { label: "Crew On Board", value: "CA - 4488 Montesano, Joshua" },
        { label: "Delay", value: "Late aircraft" },
        { label: "Pax", value: "Bookings Weight 14/6/1/0" },
        { label: "Notes", value: "Ops note" },
      ],
    });
    expect(result.arrivals[0]?.header).toEqual({
      flightNum: "P32682",
      STA: "0740",
      ATA: "0738",
      origin: "YAM",
      registration: "C-GKQA",
      gate: "05",
      pax: "B 23",
      color: "#FF0000",
      raw: ["P32682", "0740", "0738", "YAM", "C-GKQA", "05", "", "B 23", "", ""],
    });
    expect(result.arrivals[0]?.details.arrGate).toBe("05");
  });

  it("accepts supported date formats", async () => {
    await expectPostedDate(new Date(Date.UTC(2026, 3, 28)), "28APR26", "20260428");
    await expectPostedDate("2026-04-28", "28APR26", "20260428");
    await expectPostedDate("20260428", "28APR26", "20260428");
    await expectPostedDate("28APR26", "28APR26", "20260428");
  });

  it("rejects invalid dates and ambiguous station inputs", async () => {
    const browser = new NocBrowser({ baseUrl: "https://poe.example.test/RaidoMobile" });

    await expect(browser.getStationOps({ date: "2026-02-31" })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getStationOps({ date: "20260431" })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(browser.getStationOps({ date: "31APR26" })).rejects.toBeInstanceOf(
      NocBrowserError,
    );
    await expect(
      browser.getStationOps({ date: "2026-04-28", stationId: 11069, stationCode: "YTZ" }),
    ).rejects.toBeInstanceOf(NocBrowserError);
    await expect(
      browser.getStationOps({ date: "2026-04-28", sort: "Time" as unknown as StationOpsSort }),
    ).rejects.toBeInstanceOf(NocBrowserError);
    await expect(
      browser.getStationOps({
        date: "2026-04-28",
        timeMode: "Local" as unknown as StationOpsTimeMode,
      }),
    ).rejects.toBeInstanceOf(NocBrowserError);
  });

  it("resolves stationCode from the station dropdown only when provided", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, [
        htmlResponse(STATION_OPS_URL, stationOpsFormHtml()),
        htmlResponse(`${STATION_OPS_URL}?rnd=9650`, stationOpsResultsHtml()),
      ]),
    });

    await browser.getStationOps({ date: "2026-04-28", stationCode: "ytz" });

    const postedFields = expectUrlSearchParams(calls[1]?.body);
    expect(postedFields.get("ctl00$MasterMain$ddlStation")).toBe("11069");
  });

  it("preserves the page default station when station selection is omitted", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, [
        htmlResponse(STATION_OPS_URL, stationOpsFormHtml()),
        htmlResponse(`${STATION_OPS_URL}?rnd=9650`, stationOpsResultsHtml()),
      ]),
    });

    await browser.getStationOps({ date: "2026-04-28" });

    const postedFields = expectUrlSearchParams(calls[1]?.body);
    expect(postedFields.get("ctl00$MasterMain$ddlStation")).toBe("-2147483648");
  });

  it("reuses cached form state unless refreshPage is true", async () => {
    const calls: FetchCall[] = [];
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch(calls, [
        htmlResponse(STATION_OPS_URL, stationOpsFormHtml()),
        htmlResponse(`${STATION_OPS_URL}?rnd=9650`, stationOpsResultsHtml()),
        htmlResponse(`${STATION_OPS_URL}?rnd=9650`, stationOpsResultsHtml()),
        htmlResponse(STATION_OPS_URL, stationOpsFormHtml({ rnd: "9660" })),
        htmlResponse(`${STATION_OPS_URL}?rnd=9660`, stationOpsResultsHtml()),
      ]),
    });

    await browser.getStationOps({ date: "2026-04-28" });
    await browser.getStationOps({ date: "2026-04-29" });
    await browser.getStationOps({ date: "2026-04-30", refreshPage: true });

    expect(calls.map((call) => call.url)).toEqual([
      STATION_OPS_URL,
      `${STATION_OPS_URL}?rnd=9650`,
      `${STATION_OPS_URL}?rnd=9650`,
      STATION_OPS_URL,
      `${STATION_OPS_URL}?rnd=9660`,
    ]);
  });

  it("throws revision acknowledgement error when Station Ops is blocked", async () => {
    const browser = new NocBrowser({
      baseUrl: "https://poe.example.test/RaidoMobile",
      fetch: createFetch([], [htmlResponse(STATION_OPS_URL, revisionAckHtml())]),
    });

    await expect(browser.getStationOps({ date: "2026-04-28" })).rejects.toBeInstanceOf(
      NocRevisionAckRequiredError,
    );
  });
});

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
  readonly body: BodyInit | null | undefined;
}

function createFetch(calls: FetchCall[], responses: Response[]): FetchLike {
  return async (input, init) => {
    const response = responses.shift();

    if (!response) {
      throw new Error(`Unexpected URL: ${input.toString()}`);
    }

    calls.push({ url: input.toString(), init, body: init?.body });
    const responseClone = response.clone();
    Object.defineProperty(responseClone, "url", { value: response.url });
    return responseClone;
  };
}

function htmlResponse(url: string, body: string): Response {
  const response = new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function expectUrlSearchParams(body: BodyInit | null | undefined): URLSearchParams {
  expect(body).toBeInstanceOf(URLSearchParams);
  return body as URLSearchParams;
}

async function expectPostedDate(
  date: Date | string,
  expectedTextDate: string,
  expectedHiddenDate: string,
): Promise<void> {
  const calls: FetchCall[] = [];
  const browser = new NocBrowser({
    baseUrl: "https://poe.example.test/RaidoMobile",
    fetch: createFetch(calls, [
      htmlResponse(STATION_OPS_URL, stationOpsFormHtml()),
      htmlResponse(`${STATION_OPS_URL}?rnd=9650`, stationOpsResultsHtml()),
    ]),
  });

  await browser.getStationOps({ date });

  const postedFields = expectUrlSearchParams(calls[1]?.body);
  expect(postedFields.get("ctl00$MasterMain$tbDate$DateFieldTextBox")).toBe(expectedTextDate);
  expect(postedFields.get("ctl00$MasterMain$tbDate$hfDate")).toBe(expectedHiddenDate);
}

function stationOpsFormHtml({ rnd = "9650" }: { readonly rnd?: string } = {}): string {
  return `
    <!doctype html>
    <html>
      <body>
        <form id="form" action="./StationOperations.aspx?rnd=${rnd}">
          <input type="hidden" name="__VIEWSTATE" value="view-state" />
          <input type="hidden" name="__EVENTVALIDATION" value="event-validation" />
          <input type="hidden" name="ctl00$MasterMain$tbDate$hfMonthShortNames" value="JAN,FEB,MAR,APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC" />
          <input type="hidden" name="ctl00$MasterMain$tbDate$hfWdMinNames" value="Su,Mo,Tu,We,Th,Fr,Sa" />
          <input type="hidden" name="ctl00$MasterMain$tbDate$hfCalorder" value="dmy" />
          <input type="hidden" name="ctl00$MasterMain$tbDate$hfReadonly" value="" />
          <input type="hidden" name="ctl00$MasterMain$tbDate$hfMaxTwoDigitYear" value="2079" />
          <input type="hidden" name="ctl00$MasterMain$tbDate$hdnAllowEmptyDates" value="false" />
          <input name="ctl00$MasterMain$tbDate$DateFieldTextBox" value="27APR26" />
          <input name="ctl00$MasterMain$tbDate$hfDate" value="20260427" />
          <select name="ctl00$MasterMain$ddlStation">
            <option value="-2147483648">All</option>
            <option value="11069">YTZ - CYTZ - TORONTO ISLAND APT</option>
            <option value="10979">YOW - CYOW - Ottawa Airport</option>
          </select>
          <select name="ctl00$MasterMain$ddlSort">
            <option value="0">Time</option>
            <option value="1">Station</option>
          </select>
          <select name="ctl00$MasterMain$TimeMode$DP_TimeModes">
            <option value="1">UTC</option>
            <option value="2" selected>Local</option>
          </select>
          <input type="submit" name="ctl00$MasterMain$btnSearch" value="Search" />
        </form>
      </body>
    </html>
  `;
}

function stationOpsResultsHtml(): string {
  return `
    <!doctype html>
    <html>
      <body>
        <form id="form" action="./StationOperations.aspx?rnd=9650">
          <input type="hidden" name="__VIEWSTATE" value="view-state-2" />
          <div id="panelUpperWrapper">
            <div id="MasterMain_panelUpperHeader"><span id="MasterMain_lbUpper">Departures</span></div>
            <div class="ListItem">
              <div class="ItemHeader" style="color:#FFFFFF;background-color:#2AA843;">
                <table><tr class="ActivityInfoRow">
                  <td>P32459</td><td>0645</td><td>0649</td><td>YUL</td><td>C-GKQB</td><td>10</td><td></td><td>B&nbsp;21</td><td><br></td><td></td>
                </tr></table>
              </div>
              <div class="ItemDetails"><table class="ItemChildTableDetails">
                <tr><td colspan="2"><div>Gates</div></td></tr>
                <tr><td class="right">Date</td><td class="left">28APR26</td></tr>
                <tr><td class="right">Departure</td><td class="left">YTZ - CYTZ - TORONTO ISLAND APT</td></tr>
                <tr><td class="right">Arrival</td><td class="left">YUL - CYUL - PIERRE ELLIOT TRUDEAU INTL</td></tr>
                <tr><td class="right">STD</td><td class="left">0645</td></tr>
                <tr><td class="right">STA</td><td class="left">0800</td></tr>
                <tr><td class="right">Registration</td><td class="left">C-GKQB</td></tr>
                <tr><td class="right">Version</td><td class="left">DH4XX</td></tr>
                <tr><td class="right">Type</td><td class="left">DH4</td></tr>
                <tr><td class="right">Dep Gate</td><td class="left">10</td></tr>
                <tr><td class="right">Crew On Board</td><td class="left">CA - 4488 Montesano, Joshua</td></tr>
                <tr><td class="right">Delay</td><td class="left">Late aircraft</td></tr>
                <tr><td class="right">Pax</td><td class="left">Bookings<br/>Weight 14/6/1/0</td></tr>
                <tr><td class="right">Notes</td><td class="left">Ops note</td></tr>
              </table></div>
            </div>
          </div>
          <div id="panelLowerWrapper">
            <div id="MasterMain_panelLowerHeader"><span id="MasterMain_lbLower">Arrivals</span></div>
            <div class="ListItem">
              <div class="ItemHeader" style="color:#FFFFFF;background-color:#FF0000;">
                <table><tr class="ActivityInfoRow">
                  <td>P32682</td><td>0740</td><td>0738</td><td>YAM</td><td>C-GKQA</td><td>05</td><td></td><td>B&nbsp;23</td><td><br></td><td></td>
                </tr></table>
              </div>
              <div class="ItemDetails"><table class="ItemChildTableDetails">
                <tr><td class="right">Date</td><td class="left">28APR26</td></tr>
                <tr><td class="right">Departure</td><td class="left">YAM - CYAM - SAULT STE MARIE</td></tr>
                <tr><td class="right">Arrival</td><td class="left">YTZ - CYTZ - TORONTO ISLAND APT</td></tr>
                <tr><td class="right">STD</td><td class="left">0620</td></tr>
                <tr><td class="right">STA</td><td class="left">0740</td></tr>
                <tr><td class="right">Registration</td><td class="left">C-GKQA</td></tr>
                <tr><td class="right">Version</td><td class="left">DH4XX</td></tr>
                <tr><td class="right">Type</td><td class="left">DH4</td></tr>
                <tr><td class="right">Arr Gate</td><td class="left">05</td></tr>
                <tr><td class="right">Crew On Board</td><td class="left">CA - 10053 Walsh, Ryan</td></tr>
                <tr><td class="right">Pax</td><td class="left">Bookings<br/>Weight 7/16/0/0</td></tr>
              </table></div>
            </div>
          </div>
        </form>
      </body>
    </html>
  `;
}

function revisionAckHtml(): string {
  return `
    <!doctype html>
    <html>
      <body>
        <form id="form">
          <div id="MasterMain_pnlRevision">
            <input type="submit" id="MasterMain_btnConfirm" name="ctl00$MasterMain$btnConfirm" value="Confirm" />
          </div>
        </form>
      </body>
    </html>
  `;
}
