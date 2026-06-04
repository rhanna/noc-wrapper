export const REVISION_PATH = "/Grids/HumanResources/HumanResourceMyRevision.aspx";
export const LOGIN_PATH = "/Default.aspx";

export function isDefaultPageUrl(currentUrl: string): boolean {
  const url = new URL(currentUrl);
  return url.pathname.endsWith(LOGIN_PATH);
}

export function isRevisionRequiredPage(currentUrl: string): boolean {
  const url = new URL(currentUrl);
  return url.pathname.endsWith(REVISION_PATH);
}
