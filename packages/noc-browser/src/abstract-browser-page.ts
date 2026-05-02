import { load } from "cheerio";
import type { AbstractBrowser } from "./abstract-browser.js";
import type { FormFields } from "./types.js";

export interface PageLoadOptions {
  readonly refresh?: boolean;
}

export abstract class AbstractBrowserPage {
  readonly browser: AbstractBrowser;
  readonly path: string;
  currentUrl = "";
  formAction = "";
  fields: FormFields = {};
  html = "";
  loaded = false;

  protected constructor(browser: AbstractBrowser, path: string) {
    if (new.target === AbstractBrowserPage) {
      throw new TypeError("AbstractBrowserPage cannot be instantiated directly");
    }

    this.browser = browser;
    this.path = path;
  }

  async load({ refresh = false }: PageLoadOptions = {}): Promise<this> {
    if (this.loaded && !refresh) {
      return this;
    }

    const response = await this.browser.getHtml(this.path);
    this.applyHtml(response.html, response.url);
    return this;
  }

  async post(overrides: FormFields = {}, extraHeaders: HeadersInit = {}): Promise<this> {
    if (!this.loaded) {
      await this.load();
    }

    const target = this.formAction || this.currentUrl || this.path;
    const response = await this.browser.postForm(
      target,
      { ...this.fields, ...overrides },
      extraHeaders,
    );
    this.applyHtml(response.html, response.url);
    return this;
  }

  protected applyHtml(html: string, currentUrl: string): void {
    this.html = html;
    this.currentUrl = currentUrl;
    const $ = load(html);
    const form = $("form").first();
    const action = form.attr("action") ?? currentUrl;

    this.formAction = new URL(action, currentUrl).toString();
    this.fields = AbstractBrowserPage.extractFormFields(form);
    this.loaded = true;
  }

  static extractFormFields(form: { toString(): string }): FormFields {
    const $ = load(form.toString());
    const fields: FormFields = {};

    $("input[name]").each((_, input) => {
      const $input = $(input);
      const name = $input.attr("name");

      if (!name) {
        return;
      }

      const type = ($input.attr("type") ?? "text").toLowerCase();

      if (["submit", "button", "image", "file"].includes(type)) {
        return;
      }

      if ((type === "checkbox" || type === "radio") && $input.attr("checked") === undefined) {
        return;
      }

      fields[name] = $input.attr("value") ?? (type === "checkbox" || type === "radio" ? "on" : "");
    });

    $("select[name]").each((_, select) => {
      const $select = $(select);
      const name = $select.attr("name");

      if (!name) {
        return;
      }

      let option = $select.find("option[selected]").first();

      if (option.length === 0) {
        option = $select.find("option").first();
      }

      fields[name] = option.attr("value") ?? option.text();
    });

    $("textarea[name]").each((_, textarea) => {
      const $textarea = $(textarea);
      const name = $textarea.attr("name");

      if (name) {
        fields[name] = $textarea.text();
      }
    });

    return fields;
  }
}
