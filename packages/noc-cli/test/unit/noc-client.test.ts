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
      JSON.stringify(
        {
          authenticated: true,
          revisionAckRequired: false,
        },
        null,
        2,
      ),
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

    await runNocClientCli(["current-crew"]);

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
      ],
    });

    await runNocClientCli(["crew", "--username", "11538", "--password", "ActualPassword123"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.getCrew).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          crew: [
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

  it("crew passes regex name searches through unchanged", async () => {
    await saveTestSession();

    await runNocClientCli(["crew", "--name", "/hanna|robert/i"]);

    expect(nocClientMock.authenticate).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).toHaveBeenCalledWith({ name: "/hanna|robert/i" });
    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
  });

  it("crew looks up one crew row when --employee-num is provided", async () => {
    await saveTestSession();

    await runNocClientCli(["crew", "--employee-num", "11538"]);

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

  it("current-crew uses the saved session, fetches current crew, and prints JSON", async () => {
    await saveTestSession();

    await runNocClientCli(["current-crew"]);

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

  it("prints help including crew commands", async () => {
    await runNocClientCli(["--help"]);

    const help = String(logSpy.mock.calls[0]?.[0]);
    expect(help).toContain("crew");
    expect(help).toContain("current-crew");
    expect(help).toContain("--name text|/regex/flags");
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

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          loggedOut: true,
        },
        null,
        2,
      ),
    );
    await expect(runNocClientCli(["current-crew"])).rejects.toThrow(
      "No saved noc-client session found. Run noc-client auth first.",
    );
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
