import type { CookieJar } from "tough-cookie";
import {
  createNocSessionCookieJar,
  deleteNocSession,
  loadNocSession,
  saveNocSession,
  type LoadedNocCliSession,
  type NocCliSessionConfig,
} from "./noc-session.js";

const NOC_BROWSER_SESSION_CONFIG: NocCliSessionConfig = {
  sessionFileEnv: "NOC_BROWSER_SESSION_FILE",
  stateDirectoryName: "noc-cli",
  sessionFileName: "noc-browser-session.json",
  invalidStoreMessage: "noc-browser session store is invalid",
};

export type LoadedNocBrowserSession = LoadedNocCliSession;

export function createNocBrowserSessionCookieJar(): CookieJar {
  return createNocSessionCookieJar();
}

export async function loadNocBrowserSession(
  baseUrl: string,
): Promise<LoadedNocBrowserSession | undefined> {
  return loadNocSession(NOC_BROWSER_SESSION_CONFIG, baseUrl);
}

export async function saveNocBrowserSession(baseUrl: string, cookieJar: CookieJar): Promise<void> {
  await saveNocSession(NOC_BROWSER_SESSION_CONFIG, baseUrl, cookieJar);
}

export async function deleteNocBrowserSession(baseUrl: string): Promise<boolean> {
  return deleteNocSession(NOC_BROWSER_SESSION_CONFIG, baseUrl);
}
