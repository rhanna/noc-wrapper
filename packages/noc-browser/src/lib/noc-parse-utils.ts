import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function firstText($: CheerioAPI, selector: string): string | undefined {
  const text = normalizeText($(selector).first().text());

  return text || undefined;
}

export function textFrom($element: Cheerio<AnyNode>): string {
  return normalizeText($element.text());
}
