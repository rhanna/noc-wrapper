# Architecture Overview

This repository is an npm workspace with three packages:

- `@rhanna/noc-browser`: implemented low-level browser/client package for direct NOC portal interactions.
- `@scope/noc-client`: placeholder package reserved for higher-order normalized convenience APIs.
- `@scope/noc-cli`: placeholder package reserved for the command-line app.

## `@rhanna/noc-browser`

`NocBrowser` extends `AbstractBrowser`, which owns shared HTTP behavior:

- cookie-aware `fetch` wrapping through `fetch-cookie` and `tough-cookie`
- portal-relative URL resolution against the configured NOC base URL
- GET HTML requests
- POST ASP.NET form requests
- POST JSON WebMethod requests
- GET JSON API requests
- HTTP and JSON parse error handling
- ASP.NET WebMethod `{ d: ... }` response unwrapping

`NocBrowserPage` extends `AbstractBrowserPage`, which models a stateful ASP.NET Web Forms page:

- tracks `path`, `currentUrl`, `formAction`, `fields`, `html`, and `loaded`
- loads and caches page state until explicitly refreshed
- posts merged hidden form fields plus caller overrides
- extracts input, select, textarea, checked checkbox, and checked radio fields
- resolves relative form actions against the current response URL

The abstract browser and page classes are exported for subclassing but are protected/abstract and also guard against direct
runtime instantiation.

### Raw Result Contract

`@rhanna/noc-browser` public return types use `ResultRaw` naming. These contracts are raw JSON-compatible browser outputs:
NOC JSON-backed endpoints return `.d`-unwrapped NOC payloads unchanged, and HTML-backed endpoints parse page HTML into
raw structured JSON that preserves NOC strings and page shape.

Unsuffixed `Result` names are reserved for `@scope/noc-client`, where semantically interpreted domain objects,
normalization, parsed dates/times, enriched fields, and caller-friendly workflows will live.

### HTML Page Interaction Policy

Any NOC interaction that requires loading an HTML page, scraping form state, posting ASP.NET Web Forms fields, following a
page-local form action, or otherwise depending on page-local HTML state must live inside an explicit page class. Those
classes extend `NocBrowserPage` and keep their state on the page instance through `path`, `currentUrl`, `formAction`,
`fields`, `html`, and `loaded`.

Examples of this pattern are `NocLoginPage`, `NocRevisionPage`, and `NocStationOpsPage`. HTML-backed flows follow the
same model: `NocBrowser` owns one page instance and exposes thin delegating methods when a browser-level method is
useful.

Direct NOC JSON calls do not need page instances when they do not depend on loaded HTML page state. WebMethods and JSON
APIs such as `GetRoster`, `GetCurrentUserInfo`, and `GetMonthlyAccumulatedValues` remain direct browser/client calls
that use the shared authenticated fetch session and return raw NOC JSON-compatible result contracts.

`NocBrowser` owns one `NocLoginPage` for `/Default.aspx` and one `NocRevisionPage` for
`/Grids/HumanResources/HumanResourceMyRevision.aspx`. Browser methods delegate to those persistent page objects while
sharing the browser cookie jar and fetch session.

`NocBrowser.authenticate(username, password)` delegates to the browser's `NocLoginPage` and performs the low-level NOC
login flow:

- GETs `/Default.aspx`
- posts the scraped form fields plus the exact NOC credential fields
- preserves the NOC-provided form action, including `rnd`
- throws `NocAuthenticationError` when the login form remains on `Default.aspx`
- exposes the parsed NOC login error message when one is present
- returns `revisionAckRequired: true` when authentication succeeds but the response contains the active revision
  acknowledgement confirm form

Revision acknowledgement detection is content-based. The browser checks for the active confirm control
(`#MasterMain_btnConfirm` or `input[name="ctl00$MasterMain$btnConfirm"]`) and does not treat the My Revision URL alone as
acknowledgement-required state.

`NocRevisionPage` extends `NocBrowserPage` for `/Grids/HumanResources/HumanResourceMyRevision.aspx`.
`NocBrowser` exposes thin low-level helpers over its revision page instance:

- `getRevision()` always performs a fresh GET and returns the raw parsed My Revision page state
- `hasRevisionAckRequired()` performs a fresh content-based acknowledgement check
- `confirmRevision()` posts `ctl00$MasterMain$btnConfirm = Confirm` and verifies whether acknowledgement remains
  required after the POST

Parsed revision days preserve the page shape closely as `NocRevisionResultRaw`: each day exposes fixed `date` and
day-level `notes` fields plus dynamic top-level arrays keyed by the exact NOC `.ItemDetailsHeader` text. Activity rows are
HTML table-to-JSON extraction: `.ItemChildHeader td` cell text becomes row object keys, and matching `.ItemChildDetails td`
cell text becomes string values. The browser does not map `Revision`, `Current`, `New`, `Previous`, `Old`, or any other NOC
section header into semantic names; that interpretation belongs in `noc-client`. Live integration tests never call
`confirmRevision()` so they cannot acknowledge a real revision.

`NocBrowser` implements the low-level Roster WebMethod group:

- `getHumanResources()` posts `{}` to `GetHumanResources`
- `getCurrentUserInfo()` posts `{ hrId: -1 }` to `GetCurrentUserInfo`
- `getRoster({ month, year, hrId })` posts the exact caller-supplied roster identifiers to `GetRoster`
- `getCrewOnBoardDetails(activityId)` posts `{ activityId }` to `GetCrewOnBoardDetails`
- `getRosterMonthlyAccumulatedValues({ month, year, hrId })` posts the exact caller-supplied roster identifiers to
  `GetMonthlyAccumulatedValues`

These APIs validate required inputs, return raw `.d`-unwrapped NOC payloads without parsing or normalization, and do not
make convenience lookup calls. If a Roster WebMethod is blocked by active revision acknowledgement, it throws
`NocRevisionAckRequiredError`.

`NocBrowser` implements the low-level Open Time JSON API group:

- `getOpenTimeUserContext()` GETs `/api/open-time/user-context`
- `getOpenTimeRoster({ baseId })` GETs `/api/open-time/rosters/1?baseId={baseId}`
- `getOpenTimeRosterLegalityValues({ baseId })` GETs `/api/open-time/rosters/1/legality?baseId={baseId}`
- `getOpenTimePairings({ baseId })` GETs `/api/open-time/rosters/2?baseId={baseId}`
- `getOpenTimePairingsLegalityValues({ baseId })` GETs `/api/open-time/rosters/2/legality?baseId={baseId}`
- `getOpenTimePairingsBlockDetails(pairingId)` GETs `/api/open-time/rosters/2/block-details/{pairingId}`
- `getNetReserve({ isSap = false } = {})` GETs `/api/open-time/net-reserve?isSap={true|false}`

Open Time roster, legality, pairing, and block-detail calls are intentionally separate public methods. The browser never
fetches legality values or block details as hidden convenience behavior from roster or pairing calls. These APIs validate
required inputs and return raw NOC JSON payloads unchanged.

`NocBrowser` implements page-backed Station Operations through `getStationOps(...)`:

- uses `/Dialogues/Operations/StationOperations.aspx`
- caches the Station Ops page object and current ASP.NET form state
- `refreshPage: false` reuses cached form state; `refreshPage: true` performs a fresh GET before posting
- posts the exact NOC date, station, sort, time-mode, and search fields
- accepts `Date`, `YYYY-MM-DD`, `YYYYMMDD`, or `DDMMMYY` dates
- posts `stationId` directly or resolves `stationCode` from the page dropdown only when explicitly provided
- rejects calls that provide both `stationId` and `stationCode`

Station Ops returns `NocStationOpsResultRaw` as raw panel JSON keyed by the visible panel labels, such as `Departures`
and `Arrivals`. Each panel contains row objects with `header` and `details` maps. Header keys use the NOC table positions
because the page does not provide visible header labels: departures expose `Flight`, `STD`, `ATD`, `Destination`,
`Registration`, `Gate`, `Pax`, and `Color`; arrivals expose `Flight`, `STA`, `ATA`, `Origin`, `Registration`, `Gate`,
`Pax`, and `Color`. Details preserve exact NOC label text such as `Date`, `Dep Gate`, and `Crew On Board` as object keys.
The browser does not emit semantic aliases or `raw` arrays, and does not interpret header colors or normalize row values.

## Package Boundaries

`@rhanna/noc-browser` currently implements reusable browser primitives plus low-level authentication, My Revision, and
Roster/Open Time/Station Ops APIs. Browser APIs expose `ResultRaw` output contracts only. Domain APIs, normalization,
formatting, interpreted `Result` types, and CLI behavior are intentionally deferred to later phases.
