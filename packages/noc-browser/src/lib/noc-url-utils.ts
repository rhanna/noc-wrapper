export const REVISION_PATH = "/Grids/HumanResources/HumanResourceMyRevision.aspx";

export function isDefaultPageUrl(currentUrl: string): boolean {
  const url = new URL(currentUrl);
  return url.pathname.endsWith("/Default.aspx");
}

export function isRevisionRequiredPage(currentUrl: string): boolean {
  const url = new URL(currentUrl);
  return url.pathname.endsWith(REVISION_PATH);
}
