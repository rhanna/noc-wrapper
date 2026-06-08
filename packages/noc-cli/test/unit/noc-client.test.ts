import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { runNocClientCli } from "../../src/noc-client.js";

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

  beforeEach(() => {
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
      },
    });
    expect(nocClientMock.authenticate).toHaveBeenCalledWith("env-user", "env-password");
  });

  it("auth uses the default base URL when none is supplied", async () => {
    await runNocClientCli(["auth", "--username", "11538", "--password", "ActualPassword123"]);

    expect(nocClientMock.construct).toHaveBeenCalledWith({
      browserOptions: {
        baseUrl: "https://poe.noc.vmc.navblue.cloud/RaidoMobile",
      },
    });
  });

  it("prints help including auth", async () => {
    await runNocClientCli(["--help"]);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("auth"));
  });

  it("crew authenticates, fetches crew, and prints JSON", async () => {
    nocClientMock.getCrew.mockResolvedValue({
      crew: [
        {
          employeeNum: "11538",
          displayName: "Hanna Robert",
        },
      ],
    });

    await runNocClientCli(["crew", "--username", "11538", "--password", "ActualPassword123"]);

    expect(nocClientMock.authenticate).toHaveBeenCalledWith("11538", "ActualPassword123");
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
    await runNocClientCli(["crew", "--name", "hanna"]);

    expect(nocClientMock.findCrewByName).toHaveBeenCalledWith({ name: "hanna" });
    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
  });

  it("crew looks up one crew row when --employee-num is provided", async () => {
    await runNocClientCli(["crew", "--employee-num", "11538"]);

    expect(nocClientMock.authenticate).toHaveBeenCalledWith("", "");
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
    await expect(
      runNocClientCli(["crew", "--employee-num", "11538", "--name", "hanna"]),
    ).rejects.toThrow("crew accepts either --employee-num or --name, not both");

    expect(nocClientMock.getCrew).not.toHaveBeenCalled();
    expect(nocClientMock.getCrewByEmployeeNum).not.toHaveBeenCalled();
    expect(nocClientMock.findCrewByName).not.toHaveBeenCalled();
  });

  it("current-crew authenticates, fetches current crew, and prints JSON", async () => {
    await runNocClientCli(["current-crew"]);

    expect(nocClientMock.authenticate).toHaveBeenCalledWith("", "");
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

  it("rejects crew-member as an unknown command", async () => {
    await expect(runNocClientCli(["crew-member", "--employee-num", "11538"])).rejects.toThrow(
      "Unknown command: crew-member",
    );
  });

  it("prints help including crew commands", async () => {
    await runNocClientCli(["--help"]);

    const help = String(logSpy.mock.calls[0]?.[0]);
    expect(help).toContain("crew");
    expect(help).toContain("current-crew");
    expect(help).not.toContain("crew-member");
  });

  it("rejects unknown commands", async () => {
    await expect(runNocClientCli(["unknown-command"])).rejects.toThrow(
      "Unknown command: unknown-command",
    );
  });
});
