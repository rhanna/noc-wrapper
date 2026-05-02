import { AbstractBrowser } from "./abstract-browser.js";
import type { BrowserOptions } from "./types.js";

export class NocBrowser extends AbstractBrowser {
  constructor(options: BrowserOptions) {
    super(options);
  }
}
