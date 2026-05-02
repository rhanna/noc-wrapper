import type { CheerioAPI } from "cheerio";

export function firstText($: CheerioAPI, selector: string): string | undefined {
  const text = $(selector).first().text().replace(/\s+/g, " ").trim();

  return text || undefined;
}
