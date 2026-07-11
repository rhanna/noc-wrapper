import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { CookieJar } from "tough-cookie";
import { runNocBrowserCli } from "../../src/noc-browser.js";
import { saveNocBrowserSession } from "../../src/noc-browser-session.js";

const DEFAULT_BASE_URL = "https://poe.noc.vmc.navblue.cloud/RaidoMobile";

const nocBrowserMock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  construct: vi.fn(),
  getCurrentUserInfo: vi.fn(),
  getHumanResources: vi.fn(),
  getRoster: vi.fn(),
}));

vi.mock("@rhanna/noc-browser", () => {
  class NocAuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NocAuthenticationError";
    }
  }

  class MockNocBrowser {
    constructor(options: unknown) {
      nocBrowserMock.construct(options);
    }

    authenticate(username: string, password: string): Promise<unknown> {
      return nocBrowserMock.authenticate(username, password);
    }

    getCurrentUserInfo(): Promise<unknown> {
      return nocBrowserMock.getCurrentUserInfo();
    }

    getHumanResources(): Promise<unknown> {
      return nocBrowserMock.getHumanResources();
    }

    getRoster(options: unknown): Promise<unknown> {
      return nocBrowserMock.getRoster(options);
    }
  }

  return {
    NocAuthenticationError,
    NocBrowser: MockNocBrowser,
    StationOpsSort: {
      Time: "time",
      Station: "station",
    },
    StationOpsTimeMode: {
      UTC: "utc",
      Local: "local",
    },
  };
});

describe("noc-browser CLI", () => {
  let logSpy: MockInstance<[message?: unknown, ...optionalParams: unknown[]], void>;
  let sessionDir: string;

  beforeEach(async () => {
    sessionDir = await mkdtemp(join(tmpdir(), "noc-browser-test-"));
    vi.stubEnv("NOC_BROWSER_SESSION_FILE", join(sessionDir, "session.json"));
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    nocBrowserMock.authenticate.mockReset();
    nocBrowserMock.authenticate.mockResolvedValue({
      authenticated: true,
      currentUrl: `${DEFAULT_BASE_URL}/Home.aspx`,
      revisionAckRequired: false,
    });
    nocBrowserMock.construct.mockClear();
    nocBrowserMock.getCurrentUserInfo.mockReset();
    nocBrowserMock.getHumanResources.mockReset();
    nocBrowserMock.getRoster.mockReset();
    nocBrowserMock.getCurrentUserInfo.mockResolvedValue({
      Id: 11538,
      DisplayName: "11538 Hanna, Robert",
    });
    nocBrowserMock.getHumanResources.mockResolvedValue({
      HumanResources: [
        {
          Id: 42,
          EmpNo: "11538",
          DisplayName: "11538 Hanna, Robert",
        },
      ],
    });
    nocBrowserMock.getRoster.mockResolvedValue({
      Month: 6,
      Year: 2026,
      Days: [],
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.unstubAllEnvs();
    return rm(sessionDir, { recursive: true, force: true });
  });

  it("auth passes CLI credentials and base URL into NocBrowser", async () => {
    await runNocBrowserCli([
      "auth",
      "--username",
      "11538",
      "--password",
      "ActualPassword123",
      "--base-url",
      "https://poe.example.test/RaidoMobile",
    ]);

    expect(nocBrowserMock.construct).toHaveBeenCalledWith({
      baseUrl: "https://poe.example.test/RaidoMobile",
      cookieJar: expect.any(CookieJar),
    });
    expect(nocBrowserMock.authenticate).toHaveBeenCalledWith("11538", "ActualPassword123");
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          authenticated: true,
          currentUrl: `${DEFAULT_BASE_URL}/Home.aspx`,
          revisionAckRequired: false,
        },
        null,
        2,
      ),
    );
  });

  it("auth saves a session that later commands use without credentials", async () => {
    await runNocBrowserCli(["auth", "--username", "11538", "--password", "ActualPassword123"]);

    nocBrowserMock.authenticate.mockClear();
    logSpy.mockClear();

    await runNocBrowserCli(["current-user"]);

    expect(nocBrowserMock.authenticate).not.toHaveBeenCalled();
    expect(nocBrowserMock.getCurrentUserInfo).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          Id: 11538,
          DisplayName: "11538 Hanna, Robert",
        },
        null,
        2,
      ),
    );
  });

  it("rejects authenticated commands when no saved session exists", async () => {
    await expect(runNocBrowserCli(["current-user"])).rejects.toThrow(
      "No saved noc-browser session found. Run noc-browser auth first.",
    );

    expect(nocBrowserMock.getCurrentUserInfo).not.toHaveBeenCalled();
    expect(nocBrowserMock.authenticate).not.toHaveBeenCalled();
  });

  it("re-authenticates from environment credentials when the saved session expires", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    nocBrowserMock.getCurrentUserInfo
      .mockRejectedValueOnce(authenticationError("expired"))
      .mockResolvedValueOnce({
        Id: 11538,
        DisplayName: "11538 Hanna, Robert",
      });

    await runNocBrowserCli(["current-user"]);

    expect(nocBrowserMock.authenticate).toHaveBeenCalledWith("env-user", "env-password");
    expect(nocBrowserMock.getCurrentUserInfo).toHaveBeenCalledTimes(2);
  });

  it("does not re-authenticate an expired session without credentials", async () => {
    await saveTestSession();
    nocBrowserMock.getCurrentUserInfo.mockRejectedValueOnce(authenticationError("expired"));

    await expect(runNocBrowserCli(["current-user"])).rejects.toThrow(
      "NOC session expired and re-authentication requires NOC_USERNAME and NOC_PASSWORD or --username and --password.",
    );

    expect(nocBrowserMock.authenticate).not.toHaveBeenCalled();
  });

  it("allows re-authentication to be disabled", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    nocBrowserMock.getCurrentUserInfo.mockRejectedValueOnce(authenticationError("expired"));

    await expect(runNocBrowserCli(["current-user", "--reauth-attempts", "0"])).rejects.toThrow(
      "NOC session expired and re-authentication did not restore it after 0 attempt(s). Run noc-browser auth and try again.",
    );

    expect(nocBrowserMock.authenticate).not.toHaveBeenCalled();
  });

  it("stops re-authentication when credential authentication fails", async () => {
    await saveTestSession();
    vi.stubEnv("NOC_USERNAME", "env-user");
    vi.stubEnv("NOC_PASSWORD", "env-password");
    const credentialError = authenticationError("bad credentials");
    nocBrowserMock.getCurrentUserInfo.mockRejectedValueOnce(authenticationError("expired"));
    nocBrowserMock.authenticate.mockRejectedValueOnce(credentialError);

    await expect(runNocBrowserCli(["current-user"])).rejects.toBe(credentialError);

    expect(nocBrowserMock.authenticate).toHaveBeenCalledTimes(1);
    expect(nocBrowserMock.getCurrentUserInfo).toHaveBeenCalledTimes(1);
  });

  it("logout removes the saved session", async () => {
    await saveTestSession();

    await runNocBrowserCli(["logout"]);

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          loggedOut: true,
        },
        null,
        2,
      ),
    );
    await expect(runNocBrowserCli(["current-user"])).rejects.toThrow(
      "No saved noc-browser session found. Run noc-browser auth first.",
    );
  });

  it("roster can resolve employee numbers using the saved session", async () => {
    await saveTestSession();

    await runNocBrowserCli(["roster", "--month", "6", "--year", "2026", "--employee-num", "11538"]);

    expect(nocBrowserMock.authenticate).not.toHaveBeenCalled();
    expect(nocBrowserMock.getHumanResources).toHaveBeenCalledWith();
    expect(nocBrowserMock.getRoster).toHaveBeenCalledWith({
      month: 6,
      year: 2026,
      hrId: 42,
    });
  });

  it("prints help including session options", async () => {
    await runNocBrowserCli(["--help"]);

    const help = String(logSpy.mock.calls[0]?.[0]);
    expect(help).toContain("auth");
    expect(help).toContain("logout");
    expect(help).toContain("--reauth-attempts <n>");
  });
});

async function saveTestSession(baseUrl = DEFAULT_BASE_URL): Promise<void> {
  await saveNocBrowserSession(baseUrl, new CookieJar());
}

function authenticationError(message: string): Error {
  const error = new Error(message);
  error.name = "NocAuthenticationError";
  return error;
}
