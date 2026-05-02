import { AbstractBrowser } from "./lib/browser/abstract-browser.js";
import { authenticate, type NocAuthenticationResult } from "./noc-auth.js";
import type { BrowserOptions } from "./types.js";

export class NocBrowser extends AbstractBrowser {
  constructor(options: BrowserOptions) {
    super(options);
  }

  async authenticate(username: string, password: string): Promise<NocAuthenticationResult> {
    return authenticate(this, username, password);
  }
}
