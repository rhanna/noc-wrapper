import { AbstractBrowser } from "./abstract-browser.js";
import { AbstractBrowserPage } from "./abstract-browser-page.js";

export class NocBrowserPage extends AbstractBrowserPage {
  constructor(browser: AbstractBrowser, path: string) {
    super(browser, path);
  }
}
