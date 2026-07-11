import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { CookieJar } from "tough-cookie";
import { runNocClientCli } from "../../src/noc-client.js";
import { saveNocClientSession } from "../../src/noc-client-session.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

const nocClientMock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  construct: vi.fn(),
  findCrewByName: vi.fn(),
  getCrew: vi.fn(),
  getCrewByEmployeeNum: vi.fn(),
  getCurrentCrew: vi.fn(),
  getRoster: vi.fn(),
  getRosterMonthlyValues: vi.fn(),
}));

vi.mock("@scope/noc-client", () => {
  class MockNocClient {
    constructor(options: unknown) {
      nocClientMock.construct(options);
    }

    authenticate(username: string, password: string): Promise<unknown> {
      return nocClientMock.authenticate(username, password);
    }

    getCrew(): Promise<unknown> {
      return nocClientMock.getCrew();
    }

    getCurrentCrew(): Promise<unknown> {
      return nocClientMock.getCurrentCrew();
    }

    getCrewByEmployeeNum(options: unknown): Promise<unknown> {
      return nocClientMock.getCrewByEmployeeNum(options);
    }

    findCrewByName(options: unknown): Promise<unknown> {
      return nocClientMock.findCrewByName(options);
    }

    getRoster(options: unknown): Promise<unknown> {
      return nocClientMock.getRoster(options);
    }

    getRosterMonthlyValues(options: unknown): Promise<unknown> {
      return nocClientMock.getRosterMonthlyValues(options);
    }
  }

  return {
    default: MockNocClient,
    NocClient: MockNocClient,
  };
});

describe("noc-client CLI", () => {
  let logSpy: MockInstance<[message?: unknown, ...optionalParams: unknown[]], void>;
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), "noc-client-test-"));
    vi.stubEnv("NOC_CLIENT_SESSION_FILE", join(sessionDir, "session.json"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    nocClientMock.authenticate.mockReset();
    nocClientMock.authenticate.mockResolvedValue({
      authenticated: true,
      revisionAckRequired: false,
    });
    nocClientMock.construct.mockClear();
    nocClientMock.findCrewByName.mockReset();
    nocClientMock.getCrew.mockReset();
    nocClientMock.getCrewByEmployeeNum.mockReset();
    nocClientMock.getCurrentCrew.mockReset();
    nocClientMock.getRoster.mockReset();
    nocClientMock.getRosterMonthlyValues.mockReset();
    nocClientMock.findCrewByName.mockResolvedValue({ crew: [] });
    nocClientMock.getCrew.mockResolvedValue({ crew: [] });
    nocClientMock.getCrewByEmployeeNum.mockResolvedValue({
      crew: {
        employeeNum: "11538",
        displayName: "Hanna Robert",
      },
    });
    nocClientMock.getCurrentCrew.mockResolvedValue({
      crew: {
        employeeNum: "11538",
        displayName: "Hanna Robert",
      },
    });
    nocClientMock.getRoster.mockResolvedValue({
      employeeNum: "11538",
      date: "2026-06-01",
      days: [
        {
          date: "2026-06-01",
          dayNumber: 1,
          activities: [],
          notes: [],
        },
      ],
      rosterNotes: [],
    });
    nocClientMock.getRosterMonthlyValues.mockResolvedValue({
      employeeNum: "11538",
      values: [
        {
          label: "Monthly Duty",
          value: "84:52",
        },
      ],
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.unstubAllEnvs();
    return rm(sessionDir, { recursive: true, force: true });
  });

  it("auth passes CLI credentials and base URL into NocClient", async () => {
    await runNocClientCli([
      "auth",
      "--username",
      "11538",
      "--password",
      "ActualPassword123",
      "--base-url",
      "https://poe.example.test/RaidoMobile",
    ]);

    expect(nocClientMock.construct).toHaveBeenCalledWith({
      browserOptions: {
        baseUrl: "https://poe.example.test/RaidoMobile",
        cookieJar: expect.any(CookieJar),
      },
    });
    expect(nocClientMock.authenticate).toHaveBeenCalledWith("11538", "ActualPassword123");
    expect(logSpy).toHaveBeenCalledWith(
      [
        "authenticated  revisionAckRequired",
        "-------------  -------------------",
        "true           false",
      ].join("\n"),
    );
  });

  it("auth falls back to environment credentials and base URL", async () => {
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    vi.stubEnv("NOC_BASE_URL", "https://env.example.test/RaidoMobile");

    await runNocClientCli(["auth"]);

    expect(nocClientMock.construct).toHaveBeenCalledWith({
      browserOptions: {
        baseUrl: "https://env.example.test/RaidoMobile",
        cookieJar: expect.any(CookieJar),
      },
    });
    expect(nocClientMock.authenticate).toHaveBeenCalledWith("env-user", "env-password");
  });

  it("auth uses the default base URL when none is supplied", async () => {
    await runNocClientCli(["auth", "--username", "11538", "--password", "ActualPassword123"]);

    expect(nocClientMock.construct).toHaveBeenCalledWith({
      browserOptions: {
        baseUrl: "https://poe.noc.vmc.navblue.cloud/RaidoMobile",
        cookieJar: expect.any(CookieJar),
      },
    });
  });

  it("auth saves a session that later commands use without credentials", async () => {
    await runNocClientCli(["auth", "--username", "11538", "--password", "ActualPassword123"]);

    nocClientMock.authenticate.mockClear();
    logSpy.mockClear();

    await runNocClientCli(["current-crew", "--format", "json"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getCurrentCrew).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: {
            employeeNum: "11538",
            displayName: "Hanna Robert",
          },
        },
        null,
        2,
      ),
    );
  });

  it("prints help including auth", async () => {
    await runNocClientCli(["--help"]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("auth"));
  });

  it("crew uses the saved session, fetches crew, and prints JSON", async () => {
    await saveTestSession();
    nocClientMock.getCrew.mockResolvedValue({
      crew: [
        {
          employeeNum: "11538",
          displayName: "Hanna Robert",
        },
        {
          employeeNum: "9",
          displayName: "Earlier Crew",
        },
        {
          employeeNum: "22222",
          displayName: "Later Crew",
        },
      ],
    });

    await runNocClientCli([
      "crew",
      "--username",
      "11538",
      "--password",
      "ActualPassword123",
      "--format",
      "json",
    ]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getCrew).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: [
            {
              employeeNum: "9",
              displayName: "Earlier Crew",
            },
            {
              employeeNum: "11538",
              displayName: "Hanna Robert",
            },
            {
              employeeNum: "22222",
              displayName: "Later Crew",
            },
          ],
        },
        null,
        2,
      ),
    );
  });

  it("crew sorts crew lists by name when requested", async () => {
    await saveTestSession();
    nocClientMock.getCrew.mockResolvedValue({
      crew: [
        {
          employeeNum: "11538",
          displayName: "Hanna Robert",
        },
        {
          employeeNum: "22222",
          displayName: "Anna Target",
        },
      ],
    });

    await runNocClientCli(["crew", "--sort", "name", "--format", "json"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getCrew).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: [
            {
              employeeNum: "22222",
              displayName: "Anna Target",
            },
            {
              employeeNum: "11538",
              displayName: "Hanna Robert",
            },
          ],
        },
        null,
        2,
      ),
    );
  });

  it("crew searches by name when --name is provided", async () => {
    await saveTestSession();

    await runNocClientCli(["crew", "--name", "hanna"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).toHaveBeenCalledWith({ name: "hanna" });
    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
  });

  it("crew sorts name search results", async () => {
    await saveTestSession();
    nocClientMock.findCrewByName.mockResolvedValue({
      crew: [
        {
          employeeNum: "22222",
          displayName: "Later Crew",
        },
        {
          employeeNum: "11538",
          displayName: "Hanna Robert",
        },
      ],
    });

    await runNocClientCli(["crew", "--name", "/crew|hanna/i", "--format", "json"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).toHaveBeenCalledWith({ name: "/crew|hanna/i" });
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: [
            {
              employeeNum: "11538",
              displayName: "Hanna Robert",
            },
            {
              employeeNum: "22222",
              displayName: "Later Crew",
            },
          ],
        },
        null,
        2,
      ),
    );
  });

  it("crew passes regex name searches through unchanged", async () => {
    await saveTestSession();

    await runNocClientCli(["crew", "--name", "/hanna|robert/i"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).toHaveBeenCalledWith({ name: "/hanna|robert/i" });
    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
  });

  it("crew looks up one crew row when --employee-num is provided", async () => {
    await saveTestSession();

    await runNocClientCli(["crew", "--employee-num", "11538", "--format", "json"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getCrewByEmployeeNum).toHaveBeenCalledWith({ employeeNum: "11538" });
    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: {
            employeeNum: "11538",
            displayName: "Hanna Robert",
          },
        },
        null,
        2,
      ),
    );
  });

  it("crew rejects employee-num and name together", async () => {
    await saveTestSession();

    await expect(
      runNocClientCli(["crew", "--employee-num", "11538", "--name", "hanna"]),
    ).rejects.toThrow("crew accepts either --employee-num or --name, not both");

    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
    expect(nocClientMock.getCrewByEmployeeNum).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).not.toHaveBeenCalled();
  });

  it("crew rejects invalid sort keys", async () => {
    await saveTestSession();

    await expect(runNocClientCli(["crew", "--sort", "seniority"])).rejects.toThrow(
      "Option --sort must be employee-num or name",
    );

    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
    expect(nocClientMock.getCrewByEmployeeNum).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).not.toHaveBeenCalled();
  });

  it("current-crew uses the saved session, fetches current crew, and prints a table by default", async () => {
    await saveTestSession();

    await runNocClientCli(["current-crew"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getCurrentCrew).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(
      ["employeeNum  displayName", "-----------  ------------", "11538        Hanna Robert"].join(
        "\n",
      ),
    );
  });

  it("uses NOC_CLIENT_FORMAT as the default output format", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_CLIENT_FORMAT", "json");

    await runNocClientCli(["current-crew"]);

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: {
            employeeNum: "11538",
            displayName: "Hanna Robert",
          },
        },
        null,
        2,
      ),
    );
  });

  it("lets --format override NOC_CLIENT_FORMAT", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_CLIENT_FORMAT", "json");

    await runNocClientCli(["current-crew", "--format", "csv"]);

    expect(logSpy).toHaveBeenCalledWith("employeeNum,displayName\n11538,Hanna Robert");
  });

  it("prints crew rows as CSV", async () => {
    await saveTestSession();
    nocClientMock.getCrew.mockResolvedValue({
      crew: [
        {
          employeeNum: "11538",
          displayName: "Hanna, Robert",
        },
      ],
    });

    await runNocClientCli(["crew", "--format", "csv"]);

    expect(logSpy).toHaveBeenCalledWith('employeeNum,displayName\n11538,"Hanna, Robert"');
  });

  it("prints auth results as CSV", async () => {
    await runNocClientCli([
      "auth",
      "--username",
      "11538",
      "--password",
      "ActualPassword123",
      "--format",
      "csv",
    ]);

    expect(logSpy).toHaveBeenCalledWith("authenticated,revisionAckRequired\ntrue,false");
  });

  it("rejects invalid CLI output formats", async () => {
    await expect(runNocClientCli(["auth", "--format", "yaml"])).rejects.toThrow(
      "Option --format must be json, table, or csv",
    );

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
  });

  it("rejects invalid environment output formats", async () => {
    vi.stubEnv("NOC_CLIENT_FORMAT", "yaml");

    await expect(runNocClientCli(["auth"])).rejects.toThrow(
      "NOC_CLIENT_FORMAT must be json, table, or csv",
    );

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
  });

  it("prints help including crew commands", async () => {
    await runNocClientCli(["--help"]);

    const help = String(logSpy.mock.calls[0]?.[0]);
    expect(help).toContain("crew");
    expect(help).toContain("current-crew");
    expect(help).toContain("--name text|/regex/flags");
    expect(help).toContain("--sort employee-num|name");
    expect(help).toContain("--format <json|table|csv>");
  });

  it("rejects unknown commands", async () => {
    await expect(runNocClientCli(["unknown-command"])).rejects.toThrow(
      "Unknown command: unknown-command",
    );
  });

  it("rejects authenticated commands when no saved session exists", async () => {
    await expect(runNocClientCli(["current-crew"])).rejects.toThrow(
      "No saved noc-client session found. Run noc-client auth first.",
    );

    expect(nocClientMock.getCurrentCrew).not.toHaveBeenCalled();
    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
  });

  it("re-authenticates from environment credentials when the saved session expires", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    nocClientMock.getCurrentCrew
      .mockRejectedValueOnce(authenticationError("expired"))
      .mockResolvedValueOnce({
        crew: {
          employeeNum: "11538",
          displayName: "Hanna Robert",
        },
      });

    await runNocClientCli(["current-crew"]);

    expect(nocClientMock.authenticate).toHaveBeenCalledWith("env-user", "env-password");
    expect(nocClientMock.getCurrentCrew).toHaveBeenCalledTimes(2);
  });

  it("does not re-authenticate an expired session without credentials", async () => {
    await saveTestSession();
    nocClientMock.getCurrentCrew.mockRejectedValueOnce(authenticationError("expired"));

    await expect(runNocClientCli(["current-crew"])).rejects.toThrow(
      "NOC session expired and re-authentication requires NOC_USERNAME and NOC_PASSWORD or --username and --password.",
    );

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
  });

  it("allows re-authentication to be disabled", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    nocClientMock.getCurrentCrew.mockRejectedValueOnce(authenticationError("expired"));

    await expect(runNocClientCli(["current-crew", "--reauth-attempts", "0"])).rejects.toThrow(
      "NOC session expired and re-authentication did not restore it after 0 attempt(s). Run noc-client auth and try again.",
    );

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
  });

  it("stops re-authentication when credential authentication fails", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    const credentialError = authenticationError("bad credentials");
    nocClientMock.getCurrentCrew.mockRejectedValueOnce(authenticationError("expired"));
    nocClientMock.authenticate.mockRejectedValueOnce(credentialError);

    await expect(runNocClientCli(["current-crew"])).rejects.toBe(credentialError);

    expect(nocClientMock.authenticate).toHaveBeenCalledTimes(1);
    expect(nocClientMock.getCurrentCrew).toHaveBeenCalledTimes(1);
  });

  it("logout removes the saved session", async () => {
    await saveTestSession();

    await runNocClientCli(["logout"]);

    expect(logSpy).toHaveBeenCalledWith(["loggedOut", "---------", "true"].join("\n"));
    await expect(runNocClientCli(["current-crew"])).rejects.toThrow(
      "No saved noc-client session found. Run noc-client auth first.",
    );
  });

  it("roster uses the saved session, calls client by employee number, and prints JSON", async () => {
    await saveTestSession();

    await runNocClientCli([
      "roster",
      "--month",
      "6",
      "--year",
      "2026",
      "--employee-num",
      "11538",
      "--format",
      "json",
    ]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getRoster).toHaveBeenCalledWith({
      month: 6,
      year: 2026,
      employeeNum: "11538",
    });
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          employeeNum: "11538",
          date: "2026-06-01",
          days: [
            {
              date: "2026-06-01",
              dayNumber: 1,
              activities: [],
              notes: [],
            },
          ],
          rosterNotes: [],
        },
        null,
        2,
      ),
    );
  });

  it("roster resolves --current-crew before calling the employee-number client API", async () => {
    await saveTestSession();

    await runNocClientCli(["roster", "--month", "7", "--year", "2026", "--current-crew"]);

    expect(nocClientMock.getCurrentCrew).toHaveBeenCalledWith();
    expect(nocClientMock.getRoster).toHaveBeenCalledWith({
      month: 7,
      year: 2026,
      employeeNum: "11538",
    });
  });

  it("roster-monthly-values calls client by employee number and prints JSON", async () => {
    await saveTestSession();

    await runNocClientCli([
      "roster-monthly-values",
      "--month",
      "5",
      "--year",
      "2026",
      "--employee-num",
      "11538",
      "--format",
      "json",
    ]);

    expect(nocClientMock.getRosterMonthlyValues).toHaveBeenCalledWith({
      month: 5,
      year: 2026,
      employeeNum: "11538",
    });
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          employeeNum: "11538",
          values: [
            {
              label: "Monthly Duty",
              value: "84:52",
            },
          ],
        },
        null,
        2,
      ),
    );
  });

  it("roster-monthly-values resolves --current-crew before calling the client API", async () => {
    await saveTestSession();

    await runNocClientCli([
      "roster-monthly-values",
      "--month",
      "5",
      "--year",
      "2026",
      "--current-crew",
    ]);

    expect(nocClientMock.getCurrentCrew).toHaveBeenCalledWith();
    expect(nocClientMock.getRosterMonthlyValues).toHaveBeenCalledWith({
      month: 5,
      year: 2026,
      employeeNum: "11538",
    });
  });

  it("roster commands reject employee-num and current-crew together", async () => {
    await saveTestSession();

    await expect(
      runNocClientCli([
        "roster",
        "--month",
        "6",
        "--year",
        "2026",
        "--employee-num",
        "11538",
        "--current-crew",
      ]),
    ).rejects.toThrow("roster target accepts either --employee-num or --current-crew, not both");

    expect(nocClientMock.getCurrentCrew).not.toHaveBeenCalled();
    expect(nocClientMock.getRoster).not.toHaveBeenCalled();
  });

  it("roster commands reject a missing target", async () => {
    await saveTestSession();

    await expect(
      runNocClientCli(["roster-monthly-values", "--month", "6", "--year", "2026"]),
    ).rejects.toThrow("roster target requires --employee-num or --current-crew");

    expect(nocClientMock.getRosterMonthlyValues).not.toHaveBeenCalled();
  });

  it("roster commands require saved sessions", async () => {
    await expect(
      runNocClientCli(["roster", "--month", "6", "--year", "2026", "--employee-num", "11538"]),
    ).rejects.toThrow("No saved noc-client session found. Run noc-client auth first.");

    expect(nocClientMock.getRoster).not.toHaveBeenCalled();
  });

  it("roster commands require month and year", async () => {
    await saveTestSession();

    await expect(
      runNocClientCli(["roster", "--year", "2026", "--employee-num", "11538"]),
    ).rejects.toThrow("Missing required option --month");
    await expect(
      runNocClientCli(["roster-monthly-values", "--month", "6", "--employee-num", "11538"]),
    ).rejects.toThrow("Missing required option --year");

    expect(nocClientMock.getRoster).not.toHaveBeenCalled();
    expect(nocClientMock.getRosterMonthlyValues).not.toHaveBeenCalled();
  });
});

async function saveTestSession(baseUrl = DEFAULT_BASE_URL): Promise<void> {
  await saveNocClientSession(baseUrl, new CookieJar());
}

function authenticationError(message: string): Error {
  const error = new Error(message);
  error.name = "NocAuthenticationError";
  return error;
}
