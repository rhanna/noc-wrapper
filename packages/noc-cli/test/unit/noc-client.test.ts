import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { runNocClientCli } from "../../src/noc-client.js";

const nocClientMock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  construct: vi.fn(),
}));

vi.mock("@scope/noc-client", () => {
  class MockNocClient {
    constructor(options: unknown) {
      nocClientMock.construct(options);
    }

    authenticate(username: string, password: string): Promise<unknown> {
      return nocClientMock.authenticate(username, password);
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

  it("rejects unknown commands", async () => {
    await expect(runNocClientCli(["crew"])).rejects.toThrow("Unknown command: crew");
  });
});
