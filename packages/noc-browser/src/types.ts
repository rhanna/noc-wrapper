import type { CookieJar } from "tough-cookie";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface BrowserOptions {
  readonly baseUrl: string;
  readonly fetch?: FetchLike;
  readonly cookieJar?: CookieJar;
}

export interface HtmlResponse {
  readonly html: string;
  readonly url: string;
  readonly response: Response;
}

export type FormFields = Record<string, string>;
export type NocJsonPrimitive = string | number | boolean | null;
export type NocJsonValue = NocJsonPrimitive | NocJsonObject | NocJsonArray;
export type NocJsonArray = readonly NocJsonValue[];
export interface NocJsonObject {
  readonly [key: string]: NocJsonValue | undefined;
}

export type JsonObject = Record<string, unknown>;
