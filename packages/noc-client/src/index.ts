import { NocBrowser } from "@rhanna/noc-browser";
import type { NocBrowserOptions } from "@rhanna/noc-browser";

export type NocClientOptions =
  | { readonly browser: NocBrowser; readonly browserOptions?: never }
  | { readonly browser?: never; readonly browserOptions: NocBrowserOptions };

export interface NocClientAuthResult {
  readonly authenticated: true;
  readonly revisionAckRequired: boolean;
}

export class NocClient {
  readonly #browser: NocBrowser;

  constructor(options: NocClientOptions) {
    if (!isObject(options)) {
      throw new TypeError("NocClient requires exactly one of browser or browserOptions");
    }

    const hasBrowser = "browser" in options && options.browser !== undefined;
    const hasBrowserOptions = "browserOptions" in options && options.browserOptions !== undefined;

    if (hasBrowser === hasBrowserOptions) {
      throw new TypeError("NocClient requires exactly one of browser or browserOptions");
    }

    this.#browser = hasBrowser ? options.browser : new NocBrowser(options.browserOptions);
  }

  async authenticate(username: string, password: string): Promise<NocClientAuthResult> {
    const result = await this.#browser.authenticate(username, password);

    return {
      authenticated: result.authenticated,
      revisionAckRequired: result.revisionAckRequired,
    };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default NocClient;
