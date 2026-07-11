import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { NocBrowser, NocBrowserOptions } from "@rhanna/noc-browser";
import { htmlToPlainText, NocClient } from "../../src/index.js";

describe("NocClient", () => {
  it("converts HTML fragments to plain text", () => {
    expect(
      htmlToPlainText('T,LP <span style="background-color: rgb(255,255,0);">&nbsp;&nbsp;</span>'),
    ).toBe("T,LP");
    expect(htmlToPlainText("<strong>A&amp;B</strong> &lt;test&gt;")).toBe("A&B <test>");
  });

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

  it("maps crew rows from HumanResources without exposing private fields", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        {
          Id: 9227,
          DisplayName: "11538 Hanna Robert",
          FirstName: null,
          LastName: null,
          Status: null,
        },
        {
          Id: 3201,
          DisplayName: "12345 Van Der Meer Anna Maria",
          FirstName: null,
          LastName: null,
          Status: null,
        },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.getCrew()).resolves.toEqual({
      crew: [
        {
          employeeNum: "11538",
          displayName: "Hanna Robert",
        },
        {
          employeeNum: "12345",
          displayName: "Van Der Meer Anna Maria",
        },
      ],
    });
  });

  it("maps current crew from Info.CurrentUser", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getCurrentUserInfo).mockResolvedValue({
      Info: {
        CurrentUser: {
          Id: 9227,
          DisplayName: "11538",
          FirstName: null,
          LastName: null,
          Status: null,
        },
      },
    });
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 3201, DisplayName: "12345 Other Crew" },
        { Id: 9227, DisplayName: "11538 Hanna Robert" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.getCurrentCrew()).resolves.toEqual({
      crew: {
        employeeNum: "11538",
        displayName: "Hanna Robert",
      },
    });
    expect(browser.getCurrentUserInfo).toHaveBeenCalledWith();
    expect(browser.getHumanResources).toHaveBeenCalledWith();
  });

  it("looks up crew by employeeNum", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 1, DisplayName: "11111 First Match" },
        { Id: 2, DisplayName: "22222 Target Crew" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.getCrewByEmployeeNum({ employeeNum: "22222" })).resolves.toEqual({
      crew: {
        employeeNum: "22222",
        displayName: "Target Crew",
      },
    });
  });

  it("finds crew by normalized name text", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 1, DisplayName: "11111 First Match" },
        { Id: 2, DisplayName: "22222 Van Der Meer Anna Maria" },
        { Id: 3, DisplayName: "33333 Another Person" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.findCrewByName({ name: " der   meer " })).resolves.toEqual({
      crew: [
        {
          employeeNum: "22222",
          displayName: "Van Der Meer Anna Maria",
        },
      ],
    });
  });

  it("finds crew by regex name text with user-provided flags", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 1, DisplayName: "11111 First Match" },
        { Id: 2, DisplayName: "22222 Van Der Meer Anna Maria" },
        { Id: 3, DisplayName: "33333 Hanna Robert" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.findCrewByName({ name: "/van der|HANNA/i" })).resolves.toEqual({
      crew: [
        {
          employeeNum: "22222",
          displayName: "Van Der Meer Anna Maria",
        },
        {
          employeeNum: "33333",
          displayName: "Hanna Robert",
        },
      ],
    });
  });

  it("uses case-sensitive regex name searches by default", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: 1, DisplayName: "11111 Hanna Robert" }],
    });
    const client = new NocClient({ browser });

    await expect(client.findCrewByName({ name: "/hanna/" })).resolves.toEqual({ crew: [] });
  });

  it("matches regex name searches against parsed display names only", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 1, DisplayName: "11111 Visible Match" },
        { Id: 2, DisplayName: "22222 Hidden Person", FirstName: "Visible" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.findCrewByName({ name: "/visible/i" })).resolves.toEqual({
      crew: [
        {
          employeeNum: "11111",
          displayName: "Visible Match",
        },
      ],
    });
  });

  it("rejects invalid employeeNum lookup input", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.getCrewByEmployeeNum({ employeeNum: "12A45" })).rejects.toThrow(
      "employeeNum must contain only digits",
    );
  });

  it("rejects missing name search input", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.findCrewByName({ name: "   " })).rejects.toThrow("name is required");
  });

  it("rejects empty name regex searches", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.findCrewByName({ name: "/" })).rejects.toThrow(
      "name regex pattern is required",
    );
    await expect(client.findCrewByName({ name: "//" })).rejects.toThrow(
      "name regex pattern is required",
    );
  });

  it("rejects name regex searches without a closing delimiter", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.findCrewByName({ name: "/hanna" })).rejects.toThrow(
      "name regex must use /pattern/flags",
    );
  });

  it("rejects invalid name regex syntax", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.findCrewByName({ name: "/[/" })).rejects.toThrow("Invalid name regex:");
  });

  it("rejects invalid name regex flags", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.findCrewByName({ name: "/hanna/x" })).rejects.toThrow(
      "Invalid name regex:",
    );
  });

  it("rejects employeeNum lookup with no matching crew", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: 1, DisplayName: "11111 First Match" }],
    });
    const client = new NocClient({ browser });

    await expect(client.getCrewByEmployeeNum({ employeeNum: "99999" })).rejects.toThrow(
      "No crew row found for employee number: 99999",
    );
  });

  it("rejects employeeNum lookup with duplicate matching crew", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 1, DisplayName: "11111 First Match" },
        { Id: 2, DisplayName: "11111 Duplicate Match" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(client.getCrewByEmployeeNum({ employeeNum: "11111" })).rejects.toThrow(
      "Multiple crew rows found for employee number: 11111",
    );
  });

  it("rejects invalid HumanResources payloads", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({});
    const client = new NocClient({ browser });

    await expect(client.getCrew()).rejects.toThrow(
      "GetHumanResources response is missing HumanResources",
    );
  });

  it("rejects crew rows without leading employee numbers", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: 1, DisplayName: "Hanna Robert" }],
    });
    const client = new NocClient({ browser });

    await expect(client.getCrew()).rejects.toThrow(
      "Crew row display name does not start with an employee number: Hanna Robert",
    );
  });

  it("rejects lookup matches without a valid private Id", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: null, DisplayName: "11111 First Match" }],
    });
    const client = new NocClient({ browser });

    await expect(client.getCrewByEmployeeNum({ employeeNum: "11111" })).rejects.toThrow(
      "Crew row for employee number 11111 has no valid private Id",
    );
  });

  it("passes crew browser errors through unchanged", async () => {
    const error = new Error("revision acknowledgement required");
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockRejectedValue(error);
    const client = new NocClient({ browser });

    await expect(client.getCrew()).rejects.toBe(error);
  });

  it("maps roster sample payloads without exposing private roster fields", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: 9227, DisplayName: "11538 Hanna Robert" }],
    });
    vi.mocked(browser.getRoster).mockResolvedValue(readRosterSample("sample.getRoster.json"));
    const client = new NocClient({ browser });

    const result = await client.getRoster({
      month: 4,
      year: 2026,
      employeeNum: "11538",
    });

    expect(browser.getRoster).toHaveBeenCalledWith({ month: 4, year: 2026, hrId: 9227 });
    expect(result.employeeNum).toBe("11538");
    expect(result.date).toBe("2026-04-01");
    expect(result.crew).toEqual({
      employeeNum: "11538",
      displayName: "Hanna Robert",
    });
    expect(result.rosterNotes).toHaveLength(1);
    expect(result.days).toHaveLength(30);
    expect(result.days[0]).toMatchObject({
      date: "2026-04-01",
      dayNumber: 1,
      color: "#9E2335",
      departureInfo: {
        info: "YTZ",
        details: "",
        color: "158,35,53",
      },
      arrivalInfo: {
        info: "YTZ",
        details: "2359",
        color: "158,35,53",
      },
    });
    expect(result.days[0]).not.toHaveProperty("hotelInfo");
    expect(result.days[0]?.activities[0]).toEqual({
      id: 5576810,
      activity: "GD",
      std: "0001",
      dep: "YTZ",
      arr: "YTZ",
      sta: "2359",
      checkOut: "",
      info: "",
      details: {
        activity: "GD,Guaranteed Day off",
        station: {
          Id: "11069",
          Label: null,
          Value: "YTZ - CYTZ - TORONTO ISLAND APT",
          Color: null,
          Values: [],
        },
        start: "01APR26 00:01 (LT)",
        end: "01APR26 23:59 (LT)",
      },
    });
    expect(result.days[0]?.activities[0]).not.toHaveProperty("State");
    expect(result.days[0]?.activities[0]).not.toHaveProperty("ValidFrom");

    const hotelActivity = result.days
      .flatMap((day) => day.activities)
      .find((activity) => activity.details.hotel);

    expect(hotelActivity?.details).toMatchObject({
      hotel: "YOW - DoubleTree by Hilton Ottawa Downtown ",
      reservationNo: "",
      comment: "",
      pickupToHotel: "03APR26 02:09 (LT) Hotel Shuttle (20 min.)",
      pickupFromHotel: "03APR26 15:35 (LT) Hotel Shuttle (20 min.)",
    });
    expect(hotelActivity?.details.crewOnBoard?.[0]).toEqual({
      employeeNum: "11538",
      position: "CA",
      firstName: "Robert",
      lastName: "Hanna",
      email: "robert.hanna@flyporter.com",
      designators: [],
    });
  });

  it("maps monthly accumulated roster values from the sample payload", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: 9227, DisplayName: "11538 Hanna Robert" }],
    });
    vi.mocked(browser.getRosterMonthlyAccumulatedValues).mockResolvedValue(
      readMonthlyValuesSample("sample.getRosterMonthlyAccumulatedValues.json"),
    );
    const client = new NocClient({ browser });

    await expect(
      client.getRosterMonthlyValues({ month: 5, year: 2026, employeeNum: "11538" }),
    ).resolves.toEqual({
      employeeNum: "11538",
      crew: {
        employeeNum: "11538",
        displayName: "Hanna Robert",
      },
      values: [
        {
          label: "Credits (Bid Period)",
          value: "01MAY26-31MAY26: 72:33",
        },
        {
          label: "Monthly Duty",
          value: "84:52",
        },
      ],
    });
    expect(browser.getRosterMonthlyAccumulatedValues).toHaveBeenCalledWith({
      month: 5,
      year: 2026,
      hrId: 9227,
    });
  });

  it("caches employeeNum to private hrId per client instance", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 111, DisplayName: "11111 First Crew" },
        { Id: 222, DisplayName: "22222 Second Crew" },
      ],
    });
    vi.mocked(browser.getRoster).mockResolvedValue(minimalRosterPayload());
    vi.mocked(browser.getRosterMonthlyAccumulatedValues).mockResolvedValue({
      AccumulatedValues: [],
    });
    const client = new NocClient({ browser });

    await client.getRoster({ month: 6, year: 2026, employeeNum: "11111" });
    await client.getRosterMonthlyValues({ month: 7, year: 2026, employeeNum: "11111" });

    expect(browser.getHumanResources).toHaveBeenCalledTimes(1);
    expect(browser.getRoster).toHaveBeenCalledWith({ month: 6, year: 2026, hrId: 111 });
    expect(browser.getRosterMonthlyAccumulatedValues).toHaveBeenCalledWith({
      month: 7,
      year: 2026,
      hrId: 111,
    });
  });

  it("rejects invalid roster options", async () => {
    const client = new NocClient({ browser: createBrowserMock() });

    await expect(client.getRoster({ month: 0, year: 2026, employeeNum: "11538" })).rejects.toThrow(
      "month must be an integer from 1 to 12",
    );
    await expect(
      client.getRosterMonthlyValues({ month: 6, year: 0, employeeNum: "11538" }),
    ).rejects.toThrow("year must be a positive integer");
    await expect(client.getRoster({ month: 6, year: 2026, employeeNum: "11A38" })).rejects.toThrow(
      "employeeNum must contain only digits",
    );
  });

  it("rejects roster requests with no employee number match", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: 1, DisplayName: "11111 First Match" }],
    });
    const client = new NocClient({ browser });

    await expect(client.getRoster({ month: 6, year: 2026, employeeNum: "99999" })).rejects.toThrow(
      "No crew row found for employee number: 99999",
    );
    expect(browser.getRoster).not.toHaveBeenCalled();
  });

  it("rejects roster requests with duplicate employee number matches", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [
        { Id: 1, DisplayName: "11111 First Match" },
        { Id: 2, DisplayName: "11111 Duplicate Match" },
      ],
    });
    const client = new NocClient({ browser });

    await expect(
      client.getRosterMonthlyValues({ month: 6, year: 2026, employeeNum: "11111" }),
    ).rejects.toThrow("Multiple crew rows found for employee number: 11111");
    expect(browser.getRosterMonthlyAccumulatedValues).not.toHaveBeenCalled();
  });

  it("rejects roster requests when the private Id is invalid", async () => {
    const browser = createBrowserMock();
    vi.mocked(browser.getHumanResources).mockResolvedValue({
      HumanResources: [{ Id: "9227", DisplayName: "11538 Hanna Robert" }],
    });
    const client = new NocClient({ browser });

    await expect(client.getRoster({ month: 6, year: 2026, employeeNum: "11538" })).rejects.toThrow(
      "Crew row for employee number 11538 has no valid private Id",
    );
    expect(browser.getRoster).not.toHaveBeenCalled();
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

  return {
    authenticate,
    getCurrentUserInfo: vi.fn(),
    getHumanResources: vi.fn(),
    getRoster: vi.fn(),
    getRosterMonthlyAccumulatedValues: vi.fn(),
  } as unknown as NocBrowser;
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

function readSampleJson(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../../../samples/${name}`, import.meta.url), "utf8"));
}

function readRosterSample(name: string): Awaited<ReturnType<NocBrowser["getRoster"]>> {
  return readSampleJson(name) as Awaited<ReturnType<NocBrowser["getRoster"]>>;
}

function readMonthlyValuesSample(
  name: string,
): Awaited<ReturnType<NocBrowser["getRosterMonthlyAccumulatedValues"]>> {
  return readSampleJson(name) as Awaited<
    ReturnType<NocBrowser["getRosterMonthlyAccumulatedValues"]>
  >;
}

function minimalRosterPayload(): Awaited<ReturnType<NocBrowser["getRoster"]>> {
  return {
    Date: "2026-06-01T00:00:00Z",
    Roster: {
      Days: {},
      RosterNotes: [],
    },
  };
}
