import { AbstractBrowser } from "./lib/browser/abstract-browser.js";
import { AbstractBrowserPage } from "./lib/browser/abstract-browser-page.js";

export class NocBrowserPage extends AbstractBrowserPage {
  constructor(browser: AbstractBrowser, path: string) {
    super(browser, path);
  }
}
