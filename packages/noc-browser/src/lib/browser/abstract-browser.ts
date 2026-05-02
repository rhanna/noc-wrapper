import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import { NocHttpError, NocJsonError } from "../../errors.js";
import type {
  FetchLike,
  FormFields,
  HtmlResponse,
  JsonObject,
  BrowserOptions,
} from "../../types.js";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

export abstract class AbstractBrowser {
  readonly baseUrl: string;
  readonly cookieJar: CookieJar;
  protected readonly fetch: FetchLike;

  protected constructor(options: BrowserOptions) {
    if (new.target === AbstractBrowser) {
      throw new TypeError("AbstractBrowser cannot be instantiated directly");
    }

    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.cookieJar = options.cookieJar ?? new CookieJar();
    const baseFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.fetch = makeFetchCookie(baseFetch, this.cookieJar) as FetchLike;
  }

  async getHtml(pathOrUrl: string, headers: HeadersInit = {}): Promise<HtmlResponse> {
    return this.requestHtml(pathOrUrl, {
      method: "GET",
      headers,
    });
  }

  async postForm(
    pathOrUrl: string,
    fields: FormFields,
    headers: HeadersInit = {},
  ): Promise<HtmlResponse> {
    const body = new URLSearchParams(fields);

    return this.requestHtml(pathOrUrl, {
      method: "POST",
      headers: {
        "Content-Type": FORM_CONTENT_TYPE,
        ...headers,
      },
      body,
    });
  }

  async postWebMethod<T = unknown>(
    pathOrUrl: string,
    payload: JsonObject,
    headers: HeadersInit = {},
  ): Promise<T> {
    const json = await this.requestJson<unknown>(pathOrUrl, {
      method: "POST",
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
        Accept: JSON_CONTENT_TYPE,
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    return this.unwrapAspNetD<T>(json);
  }

  async getJsonApi<T = unknown>(pathOrUrl: string, headers: HeadersInit = {}): Promise<T> {
    return this.requestJson<T>(pathOrUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers,
      },
    });
  }

  unwrapAspNetD<T = unknown>(payload: unknown): T {
    if (isJsonObject(payload) && Object.prototype.hasOwnProperty.call(payload, "d")) {
      return payload.d as T;
    }

    return payload as T;
  }

  resolveUrl(pathOrUrl: string): string {
    if (URL.canParse(pathOrUrl)) {
      return pathOrUrl;
    }

    const relativePath = pathOrUrl.startsWith("/") ? pathOrUrl.slice(1) : pathOrUrl;
    return new URL(relativePath, this.baseUrl).toString();
  }

  private async requestHtml(pathOrUrl: string, init: RequestInit): Promise<HtmlResponse> {
    const response = await this.request(pathOrUrl, init);
    const html = await response.text();

    return {
      html,
      url: response.url,
      response,
    };
  }

  private async requestJson<T>(pathOrUrl: string, init: RequestInit): Promise<T> {
    const response = await this.request(pathOrUrl, init);
    const body = await response.text();

    try {
      return JSON.parse(body) as T;
    } catch (error) {
      throw new NocJsonError(`NOC returned invalid JSON from ${response.url}`, body);
    }
  }

  private async request(pathOrUrl: string, init: RequestInit): Promise<Response> {
    const url = this.resolveUrl(pathOrUrl);
    const response = await this.fetch(url, {
      redirect: "follow",
      ...init,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new NocHttpError(`NOC request failed with ${response.status} ${response.statusText}`, {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        body,
      });
    }

    return response;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
