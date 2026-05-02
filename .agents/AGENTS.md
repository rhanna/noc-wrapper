Implement a type-safe `NocBrowser` library for the NOC web portal.

  Goal:
  Build a pure browser/client layer that talks directly to the NOC portal and exposes low-level APIs for NOC operations. This
  layer must not implement product workflows, convenience behavior, retries, fallback flows, sorting, filtering, enrichment, or
  data normalization. Higher-order behavior will be implemented by another wrapper layer.

  Core requirements:
  - Use TypeScript or fully type-safe JavaScript patterns for all code.
  - Define explicit types/interfaces for public API inputs, outputs, page wrappers, errors, and parsed page structures.
  - Avoid `any` except at raw NOC payload boundaries.
  - Use `fetch-cookie` to wrap `fetch` and maintain cookies/session state.
  - Support ASP.NET Web Forms:
    - scrape `<form>` action URLs
    - preserve and repost hidden fields such as `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`
    - preserve form state between posts where page-backed APIs require it
  - Unwrap ASP.NET JSON WebMethod responses shaped as `{ d: ... }`.
  - Return NOC payloads as-is after `.d` unwrapping.
  - Do not normalize, enrich, rename, sort, filter, or transform NOC data.
  - Do not infer client intent.
  - Do not add retry logic.
  - Do not make extra remote calls for convenience.
  - Throw errors for API misuse, request failures, authentication failure, revision-ack-required failures, and page states that
  make the requested low-level operation impossible.

  Revision acknowledgement rule:
  - Use the name `RevisionAckRequired`, not `RevisionActRequired`.
  - Export `NocRevisionAckRequiredError`.
  - Use result/status field name `revisionAckRequired`.
  - A NOC call that fails to achieve its goal because it is redirected to revision acknowledgement must throw
  `NocRevisionAckRequiredError`.
  - A NOC call that succeeds in its primary goal but detects revision acknowledgement, such as `authenticate()`, should return
  that status in its response instead of throwing.
  - Revision acknowledgement should be detected by actual revision acknowledgement content/form, not merely by being on the My
  Revision page.

  Public API:
  Implement and export:

  ```ts
  export class NocBrowser
  export class NocBrowserPage
  export class NocRevisionPage extends NocBrowserPage
  export class NocRevisionAckRequiredError extends Error
  export enum StationOpsSort
  export enum StationOpsTimeMode
  export default NocBrowser

  Authentication:
  Implement:

  await noc.authenticate(username, password)

  Behavior:

  - GET /Default.aspx
  - scrape the login form action, including the rnd query value from the form action
  - POST credentials using scraped hidden fields
  - do not invent rnd
  - post these fields:
      - ctl00$MasterMain$txtUserName
      - ctl00$MasterMain$txtPassword
      - ctl00$MasterMain$languageid = 1
      - ctl00$MasterMain$cbSave = on
      - ctl00$MasterMain$btnSub = Login
  - detect failed login by checking whether the login form remains on Default.aspx
  - parse the returned HTML to extract and include the NOC-reported login error message
  - if authentication succeeds but lands on revision acknowledgement, return revisionAckRequired: true and parsed revision
    details
  - return typed authentication result on success

  Revision APIs:
  Implement:

  await noc.getMyRevision()
  await noc.confirmMyRevision()
  await noc.hasRevisionAckRequired()

  Behavior:

  - getMyRevision() always performs a fresh GET of /Grids/HumanResources/HumanResourceMyRevision.aspx
  - no refresh parameter
  - this call is cheap enough; do not cache-optimize it
  - confirmMyRevision() posts the scraped confirm form button:
      - ctl00$MasterMain$btnConfirm = Confirm
  - after confirm, verify whether revision ack is still required
  - do not call roster or other APIs as part of confirmation
  - if confirmation cannot complete because revision ack is still required, return a structured result indicating that
  - if another NOC interaction is blocked by revision acknowledgement, throw NocRevisionAckRequiredError

  Revision selectors and parsing:

  - revision page path:
      - /Grids/HumanResources/HumanResourceMyRevision.aspx
  - revision form/button selectors:
      - #MasterMain_btnConfirm
      - input[name="ctl00$MasterMain$btnConfirm"]
  - revision day selector:
      - .ListItem
  - day header selector:
      - .ItemDayHeader
  - section header selector:
      - .ItemDetailsHeader
  - activity container selector:
      - .ItemChildHolder
  - activity header cells:
      - .ItemChildHeader td
  - activity detail cells:
      - .ItemChildDetails td
  - notes selector:
      - .ItemNotes

  Each parsed revision day should expose:

  - date
  - revision: the new/revised roster section
  - current: the old/current/previous roster section
  - activities: flat compatibility list of all parsed activities

  Map section headers:

  - “Revision” / “New” -> revision
  - “Current” / “Previous” / “Old” -> current

  Do not rename NOC business fields beyond minimal structural keys needed to represent the page.

  Human resources:
  Implement:

  await noc.getHumanResources()

  Behavior:

  - POST WebMethod:
    /Dialogues/HumanResources/HumanResourceRoster.aspx/GetHumanResources
  - payload: {}
  - return the NOC payload unchanged after .d unwrapping
  - do not parse display names
  - do not split names
  - do not add employee number fields
  - no sorting

  Current user:
  Implement:

  await noc.getCurrentUserInfo()

  Behavior:

  - POST WebMethod:
    /Dialogues/HumanResources/HumanResourceRoster.aspx/GetCurrentUserInfo
  - payload:

  { hrId: -1 }

  No public hrId parameter.

  Roster:
  Implement:

  await noc.getRoster({ month, year, hrId })

  Behavior:

  - validate month, year, and hrId are supplied
  - POST WebMethod:
    /Dialogues/HumanResources/HumanResourceRoster.aspx/GetRoster
  - payload:

  { month, year, hrId }

  - return the NOC roster payload unchanged after .d unwrapping
  - do not call getHumanResources()
  - do not support employee-number lookup
  - do not probe revision status for convenience
  - if the interaction is blocked by revision acknowledgement, throw NocRevisionAckRequiredError

  Crew on board:
  Implement:

  await noc.getCrewOnBoardDetails(activityId)

  Behavior:

  - validate activityId is supplied
  - POST WebMethod:
    /Dialogues/HumanResources/HumanResourceCrewOnBoardDetails.aspx/GetCrewOnBoardDetails
  - payload:

  { activityId }

  Open Time:
  Implement:

  await noc.getOpenTimeUserContext()
  await noc.getOpenTimeRoster({ baseId, includeLegalityValues = false })
  await noc.getOpenTimePairings({ baseId, includeLegalityValues = false, includeBlockDetails = false })
  await noc.getNetReserve({ isSap = false } = {})

  Behavior:

  - getOpenTimeUserContext() GETs /api/open-time/user-context
  - getOpenTimeRoster() GETs /api/open-time/rosters/1?baseId=...
  - getOpenTimePairings() GETs /api/open-time/rosters/2?baseId=...
  - baseId is required for Open Time roster and pairing calls; if omitted, throw
  - if includeLegalityValues is true, fetch and merge:
      - /api/open-time/rosters/{period}/legality?baseId=...
  - if includeBlockDetails is true for pairings, fetch and attach:
      - /api/open-time/rosters/2/block-details/{id}
  - do not add other convenience calls

  Net reserve:

  await noc.getNetReserve({ isSap = false } = {})

  GET:
  /api/open-time/net-reserve?isSap=true|false

  Station Operations:
  Implement:

  await noc.getStationOps({
    date,
    stationId,
    stationCode,
    sort = StationOpsSort.Time,
    timeMode = StationOpsTimeMode.Local,
    refreshPage = false,
  })

  Use enums instead of raw numeric parameters:

  export enum StationOpsSort {
    Time = 0,
    Station = 1,
  }

  export enum StationOpsTimeMode {
    UTC = 1,
    Local = 2,
  }

  Behavior:

  - page-backed ASP.NET interaction with:
    /Dialogues/Operations/StationOperations.aspx
  - initial page load is expensive; cache the page object and its current form state
  - refreshPage: false reuses the cached page/form state
  - refreshPage: true forces a fresh GET of Station Ops before posting the search
  - do not decide automatically when to refresh
  - date is required and may be accepted as Date, YYYY-MM-DD, YYYYMMDD, or DDMMMYY
  - use NOC form field names exactly
  - stationId should be posted directly when provided
  - stationCode may be resolved from the NOC station dropdown only when the caller explicitly provides stationCode
  - return parsed departures and arrivals separately
  - keep parsed row fields close to the NOC page structure
  - do not swap, infer, enrich, or normalize station fields
  - if redirected to revision acknowledgement and Station Ops cannot complete, throw NocRevisionAckRequiredError

  Station Ops form fields:

  - ctl00$MasterMain$tbDate$DateFieldTextBox
  - ctl00$MasterMain$tbDate$hfDate
  - ctl00$MasterMain$ddlStation
  - ctl00$MasterMain$ddlSort
  - ctl00$MasterMain$TimeMode$DP_TimeModes
  - ctl00$MasterMain$btnSearch = Search

  Station Ops selectors:

  - station dropdown:
      - select[name="ctl00$MasterMain$ddlStation"] option
  - departures panel:
      - #panelUpperWrapper
  - arrivals panel:
      - #panelLowerWrapper
  - row selector:
      - .ListItem
  - summary/header row:
      - .ItemHeader .ActivityInfoRow td
  - detail rows:
      - .ItemDetails tr
  - row links:
      - .ItemDetails a[href]
  - row color/style:
      - .ItemHeader[style]

  NocBrowserPage:

  - Represents an ASP.NET page.
  - Stores:
      - path
      - currentUrl
      - formAction
      - fields
      - html
      - loaded
  - Supports:
      - load({ refresh = false } = {})
      - post(overrides = {}, extraHeaders = {})
      - static extractFormFields(form)

  ASP.NET form parsing:

  - include inputs with name
  - skip submit/button/image/file inputs by default
  - include checked checkbox/radio inputs only
  - include selected select options
  - include textarea values
  - resolve relative form actions against the current page URL

  Revision redirect detection:

  - Any HTML response or followed redirect that contains the active revision acknowledgement form/content should be considered
    revision ack required.
  - Do not treat an empty My Revision page without active acknowledgement content as revision ack required.
  - If the requested operation cannot complete because of that state, throw NocRevisionAckRequiredError.

  Tests:
  Add focused unit tests for:

  - form action scraping with rnd
  - hidden field preservation
  - WebMethod .d unwrapping
  - authentication form post
  - failed login detection and parsed login error message
  - authentication success with revisionAckRequired: true
  - revision ack required detection
  - revision page without active acknowledgement form should not be reported as revision ack required
  - all NOC interactions that fail due to revision ack throw NocRevisionAckRequiredError
  - getHumanResources() returns raw NOC payload unchanged
  - getCurrentUserInfo() posts { hrId: -1 }
  - getRoster() posts exactly { month, year, hrId }
  - getCrewOnBoardDetails(activityId)
  - Open Time calls require baseId
  - renamed Open Time APIs:
      - getOpenTimeUserContext
      - getOpenTimePairings
  - Station Ops enum values are posted correctly
  - Station Ops form caching and departure/arrival parsing
  - Station Ops revision redirect error

  Integration tests:

  - Put live tests behind npm run test:integration
  - Load credentials from environment or .env.test using dotenv
  - npm test must run unit tests only
  - npm run test:integration must assert credentials are present
  - Integration tests must not auto-confirm a revision unless a dedicated explicit test mode is added

  Package:

  - Provide scripts:
      - test
      - test:unit
      - test:integration
  - Export the browser API from the main module
  - Keep CLI/convenience behavior out of this library unless implemented in a separate wrapper module

  Important design rule:
  NocBrowser is not a product abstraction. It is a faithful low-level NOC portal interaction layer. If a feature requires
  interpreting, sorting, enriching, convenience lookup, retrying, or deciding what the user probably wants, do not put that
  behavior in NocBrowser.
