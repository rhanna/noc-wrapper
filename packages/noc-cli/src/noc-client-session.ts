import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir, platform } from "node:os";
import { CookieJar } from "tough-cookie";

const SESSION_STORE_VERSION = 1;
const SESSION_FILE_ENV = "NOC_CLIENT_SESSION_FILE";

interface NocClientSessionRecord {
  readonly baseUrl: string;
  readonly savedAt: string;
  readonly cookieJar: CookieJar.Serialized;
}

interface NocClientSessionStore {
  readonly version: 1;
  readonly sessions: Record<string, NocClientSessionRecord>;
}

export interface LoadedNocClientSession {
  readonly baseUrl: string;
  readonly cookieJar: CookieJar;
  readonly savedAt: string;
}

export function createNocClientSessionCookieJar(): CookieJar {
  return new CookieJar();
}

export async function loadNocClientSession(
  baseUrl: string,
): Promise<LoadedNocClientSession | undefined> {
  const store = await readSessionStore();
  const normalizedBaseUrl = normalizeSessionBaseUrl(baseUrl);
  const session = store.sessions[normalizedBaseUrl];

  if (!session) {
    return undefined;
  }

  return {
    baseUrl: session.baseUrl,
    cookieJar: CookieJar.deserializeSync(session.cookieJar),
    savedAt: session.savedAt,
  };
}

export async function saveNocClientSession(baseUrl: string, cookieJar: CookieJar): Promise<void> {
  const store = await readSessionStore();
  const normalizedBaseUrl = normalizeSessionBaseUrl(baseUrl);
  const nextStore: NocClientSessionStore = {
    version: SESSION_STORE_VERSION,
    sessions: {
      ...store.sessions,
      [normalizedBaseUrl]: {
        baseUrl: normalizedBaseUrl,
        savedAt: new Date().toISOString(),
        cookieJar: cookieJar.serializeSync(),
      },
    },
  };

  await writeSessionStore(nextStore);
}

export async function deleteNocClientSession(baseUrl: string): Promise<boolean> {
  const store = await readSessionStore();
  const normalizedBaseUrl = normalizeSessionBaseUrl(baseUrl);

  if (!Object.prototype.hasOwnProperty.call(store.sessions, normalizedBaseUrl)) {
    return false;
  }

  const { [normalizedBaseUrl]: _deleted, ...sessions } = store.sessions;
  await writeSessionStore({
    version: SESSION_STORE_VERSION,
    sessions,
  });

  return true;
}

function normalizeSessionBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

async function readSessionStore(): Promise<NocClientSessionStore> {
  const sessionFile = getSessionFilePath();

  try {
    const contents = await readFile(sessionFile, "utf8");
    return parseSessionStore(contents);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        version: SESSION_STORE_VERSION,
        sessions: {},
      };
    }

    throw error;
  }
}

function parseSessionStore(contents: string): NocClientSessionStore {
  const parsed: unknown = JSON.parse(contents);

  if (!isObject(parsed) || parsed.version !== SESSION_STORE_VERSION || !isObject(parsed.sessions)) {
    throw new Error("noc-client session store is invalid");
  }

  return parsed as unknown as NocClientSessionStore;
}

async function writeSessionStore(store: NocClientSessionStore): Promise<void> {
  const sessionFile = getSessionFilePath();
  const sessionDir = dirname(sessionFile);
  const tempFile = `${sessionFile}.${process.pid}.tmp`;

  await mkdir(sessionDir, { recursive: true, mode: 0o700 });
  await writeFile(tempFile, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(tempFile, sessionFile);
}

function getSessionFilePath(): string {
  const override = process.env[SESSION_FILE_ENV];

  if (override && override.length > 0) {
    return override;
  }

  return join(getDefaultStateDirectory(), "noc-cli", "noc-client-session.json");
}

function getDefaultStateDirectory(): string {
  if (process.env.XDG_STATE_HOME) {
    return process.env.XDG_STATE_HOME;
  }

  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }

  if (platform() === "win32" && process.env.APPDATA) {
    return process.env.APPDATA;
  }

  return join(homedir(), ".local", "state");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
