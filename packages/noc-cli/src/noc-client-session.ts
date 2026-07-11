import type { CookieJar } from "tough-cookie";
import {
  createNocSessionCookieJar,
  deleteNocSession,
  loadNocSession,
  saveNocSession,
  type LoadedNocCliSession,
  type NocCliSessionConfig,
} from "./noc-session.js";

const NOC_CLIENT_SESSION_CONFIG: NocCliSessionConfig = {
  sessionFileEnv: "NOC_CLIENT_SESSION_FILE",
  stateDirectoryName: "noc-cli",
  sessionFileName: "noc-client-session.json",
  invalidStoreMessage: "noc-client session store is invalid",
};

export type LoadedNocClientSession = LoadedNocCliSession;

export function createNocClientSessionCookieJar(): CookieJar {
  return createNocSessionCookieJar();
}

export async function loadNocClientSession(
  baseUrl: string,
): Promise<LoadedNocClientSession | undefined> {
  return loadNocSession(NOC_CLIENT_SESSION_CONFIG, baseUrl);
}

export async function saveNocClientSession(baseUrl: string, cookieJar: CookieJar): Promise<void> {
  await saveNocSession(NOC_CLIENT_SESSION_CONFIG, baseUrl, cookieJar);
}

export async function deleteNocClientSession(baseUrl: string): Promise<boolean> {
  return deleteNocSession(NOC_CLIENT_SESSION_CONFIG, baseUrl);
}
