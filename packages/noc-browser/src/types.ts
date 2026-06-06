import type { CookieJar } from "tough-cookie";

/**
 * Fetch-compatible function used for NOC HTTP requests.
 */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Options for constructing a low-level NOC browser session.
 */
export interface BrowserOptions {
  /** Base URL for the NOC portal, such as `https://example.com/NOC`. */
  readonly baseUrl: string;
  /** Optional fetch implementation, mainly for tests or custom transports. */
  readonly fetch?: FetchLike;
  /** Optional cookie jar to share or inspect the NOC session state. */
  readonly cookieJar?: CookieJar;
}

/**
 * Raw HTML response with the final response URL and original `Response`.
 */
export interface HtmlResponse {
  readonly html: string;
  readonly url: string;
  readonly response: Response;
}

/**
 * ASP.NET Web Forms field map used when posting page state.
 */
export type FormFields = Record<string, string>;

/**
 * Primitive value allowed in raw JSON-compatible NOC results.
 */
export type NocJsonPrimitive = string | number | boolean | null;

/**
 * JSON-compatible value allowed in raw NOC browser results.
 */
export type NocJsonValue = NocJsonPrimitive | NocJsonObject | NocJsonArray;

/**
 * JSON-compatible array allowed in raw NOC browser results.
 */
export type NocJsonArray = readonly NocJsonValue[];

/**
 * JSON-compatible object used for raw NOC browser result contracts.
 */
export interface NocJsonObject {
  readonly [key: string]: NocJsonValue | undefined;
}

/**
 * Internal JSON object boundary for untyped NOC payloads.
 */
export type JsonObject = Record<string, unknown>;
