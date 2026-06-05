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

### HTML Page Interaction Policy

Any NOC interaction that requires loading an HTML page, scraping form state, posting ASP.NET Web Forms fields, following a
page-local form action, or otherwise depending on page-local HTML state must live inside an explicit page class. Those
classes extend `NocBrowserPage` and keep their state on the page instance through `path`, `currentUrl`, `formAction`,
`fields`, `html`, and `loaded`.

Examples of this pattern are `NocLoginPage` and `NocRevisionPage`. Future HTML-backed flows, such as `StationOpsPage`,
must follow the same model: `NocBrowser` owns one page instance and exposes thin delegating methods when a browser-level
method is useful.

Direct NOC JSON calls do not need page instances when they do not depend on loaded HTML page state. WebMethods and JSON
APIs such as `GetRoster`, `GetCurrentUserInfo`, and `GetMonthlyAccumulatedValues` should remain direct browser/client
calls that use the shared authenticated fetch session.

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

- `getRevision()` always performs a fresh GET and returns the parsed My Revision page state
- `hasRevisionAckRequired()` performs a fresh content-based acknowledgement check
- `confirmRevision()` posts `ctl00$MasterMain$btnConfirm = Confirm` and verifies whether acknowledgement remains
  required after the POST

Parsed revision days preserve the page shape closely: each day exposes `date`, `revision`, `current`, flat `activities`,
and day-level `notes`. Revision section headers `Revision` and `New` map to `revision`; `Current`, `Previous`, and `Old`
map to `current`. Activities keep the original section header, table headers, detail values, header/value fields, and
notes. Live integration tests never call `confirmRevision()` so they cannot acknowledge a real revision.

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

## Package Boundaries

`@rhanna/noc-browser` currently implements reusable browser primitives plus low-level authentication, My Revision, and
Roster APIs. Domain APIs, normalization, formatting, and CLI behavior are intentionally deferred to later phases.
