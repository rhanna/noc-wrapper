# Architecture Overview

This repository is an npm workspace with three packages:

- `@rhanna/noc-browser`: implemented low-level browser/client package for direct NOC portal interactions.
- `@scope/noc-client`: planned higher-order wrapper for normalized convenience APIs.
- `@scope/noc-cli`: command-line app with raw `noc-browser` and planned interpreted `noc-client` executables.

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
HTML table-to-JSON extraction with two raw maps: `Activity` maps the parsed `itemdetailslabels td` labels to the matching
`.ItemChildHeader td` values by position, and `ActivityDetails` maps each `.ItemChildDetails` label/value row. The browser
does not hard-code activity labels, detail labels, or `Revision`, `Current`, `New`, `Previous`, `Old`, or any other NOC
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

## Planned `@scope/noc-client`

`@scope/noc-client` is the planned interpreted wrapper over `@rhanna/noc-browser`. It owns semantic result types,
normalization, convenience lookup, composed calls, and caller-friendly workflows. Public client result contracts use
unsuffixed `Result` names. The client must not change the browser package's raw APIs or `ResultRaw` contract.

Phase 7 work is split into model-review-gated sub-phases. For each sub-phase, the proposed public data model and
matching `noc-client` CLI behavior must be reviewed before implementation starts. Each completed implementation phase
should produce its own commit using the planned commit message in `.agents/tasks.md`.

Client boundary rules:

- Use "crew" naming in `noc-client`, not "human resources".
- Do not expose `hrId` in public `NocClient` APIs or results.
- Roster client APIs target either current user or employee number.
- Keep the existing `noc-browser` CLI employee-number roster convenience as an explicit exception.
- Duplicate employee-number parsing in `noc-client`; do not move the raw CLI parsing helper into the client.
- Keep revision confirmation manual and explicit.
- Keep `noc-browser` low-level behavior raw and unchanged.
- Add `packages/noc-cli/src/noc-client.ts` commands in the same phase as each accepted `noc-client` domain API.
- Print accepted `noc-client` result models directly as JSON from the `noc-client` CLI.

### `noc-client` CLI Session Persistence

Persistent authentication state belongs only to `@scope/noc-cli`. `@scope/noc-client` remains a stateless interpreted
wrapper over the injected `NocBrowser` session, and `@rhanna/noc-browser` remains low-level: it does not retry, re-login,
or implement persistent CLI workflows.

The `noc-client` executable stores only NOC session cookies and session metadata. It must never persist usernames,
passwords, or other credential material. `noc-client auth` authenticates with credentials from `--username`/`--password`
or `NOC_USERNAME`/`NOC_PASSWORD`, then saves the authenticated cookie jar for the configured base URL. Auth-required
`noc-client` commands load that saved cookie jar and execute without calling `authenticate`. If no saved session exists,
they fail with guidance to run `noc-client auth`.

Session expiry is detected reactively. When an auth-required command using a saved session receives a
`NocAuthenticationError`, the CLI may attempt re-authentication and retry the original command. Re-authentication uses
only credentials supplied by flags or environment variables; if credentials are unavailable, the CLI reports the expired
session and tells the user to authenticate again. Re-authentication attempts are controlled by `--reauth-attempts` or
`NOC_REAUTH_ATTEMPTS`, default to `3`, and can be disabled with `0`. Credential authentication failures are surfaced
without repeated retries. `noc-client logout` deletes the saved session for the active base URL.

Planned sub-phases:

- Phase 7.1 establishes `NocClient`, construction/session options, auth result types, `packages/noc-client` unit test
  wiring, persistent `noc-client` CLI session storage, `noc-client auth`, and `noc-client logout`.
- Phase 7.2 adds crew identity models, lookup by employee number while hiding private browser `hrId` use, and crew CLI
  commands.
- Phase 7.3 adds roster and monthly value convenience APIs using only current-user or employee-number targets plus roster
  CLI commands.
- Phase 7.4 adds Open Time convenience APIs that compose optional legality and block-detail browser calls plus Open Time
  CLI commands.
- Phase 7.5 adds Revision client models by converting dynamic raw sections into ordered section arrays plus revision CLI
  commands.
- Phase 7.6 adds Station Ops client models with stable departure and arrival arrays plus the Station Ops CLI command.
