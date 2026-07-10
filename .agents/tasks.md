# Tasks

## Active
- None

## Backlog
- [ ] Phase 7.1: `noc-client` foundation and auth CLI
  - Status: planned, model review required before implementation.
  - Context: Replace the placeholder `@scope/noc-client` export with the
    foundation for a higher-order client wrapper over `@rhanna/noc-browser`.
    This phase must not add domain-specific roster, crew, Open Time, Revision,
    or Station Ops behavior yet. It should also make the `noc-client`
    executable useful for authentication only.
  - Proposed model:
    ```ts
    export type NocClientOptions =
      | { readonly browser: NocBrowser; readonly browserOptions?: never }
      | { readonly browser?: never; readonly browserOptions: NocBrowserOptions };

    export interface NocClientAuthResult {
      readonly authenticated: true;
      readonly revisionAckRequired: boolean;
    }
    ```
  - Expected behavior: export `NocClient` and default `NocClient`; accept either
    an injected `NocBrowser` or browser construction options, but not both;
    delegate authentication and expose only `authenticated` and
    `revisionAckRequired`; add unit-test wiring for `packages/noc-client`.
  - CLI behavior: add `noc-client auth`, reading `--username`, `--password`,
    `--base-url`, or the existing `NOC_USERNAME`, `NOC_PASSWORD`, and
    `NOC_BASE_URL` environment variables; print `NocClientAuthResult` as JSON.
  - Verification: `npm run format`, `npm run build`, relevant
    `packages/noc-client` unit tests, and a CLI auth smoke/unit test.
  - Commit message:
    ```text
    Add noc-client foundation and auth CLI
    ```
- [ ] Phase 7.2: `noc-client` Crew identity APIs and CLI
  - Status: planned, model review required before implementation.
  - Context: In `noc-client`, use "crew" naming instead of "human resources".
    Public `NocClient` APIs and results must not expose `hrId`. Internally,
    private records may retain `hrId` only to perform browser calls. Duplicate
    employee-number parsing in `noc-client`; do not move the existing
    convenience behavior out of `packages/noc-cli/src/noc-browser.ts`.
  - Proposed model:
    ```ts
    export interface NocCrew {
      readonly employeeNum: string;
      readonly displayName: string;
    }

    export interface NocCurrentCrewResult {
      readonly crew: NocCrew;
    }

    export interface NocCrewListResult {
      readonly crew: readonly NocCrew[];
    }

    export interface NocCrewLookupOptions {
      readonly employeeNum: string;
    }

    export interface NocCrewLookupResult {
      readonly crew: NocCrew;
    }

    export interface NocCrewNameSearchOptions {
      readonly name: string;
    }
    ```
  - Expected behavior: add `getCrew()`, `getCurrentCrew()`,
    `getCrewByEmployeeNum()`, and `findCrewByName()`; derive `employeeNum` from
    leading digits in `DisplayName`; keep `displayName` because live NOC
    `FirstName` and `LastName` are null and 3+ token names cannot be split
    safely; strip the leading employee number from public `displayName`; resolve
    `getCurrentCrew()` through `GetHumanResources` after reading the current
    user's employee number because `GetCurrentUserInfo` may return only the
    employee number as `DisplayName`; do not expose `Status` because live NOC
    currently returns it as null for every crew row; handle no match, duplicate
    match, invalid employee number, invalid name search, invalid payloads, and
    missing valid private `Id`.
  - CLI behavior: support `noc-client crew`,
    `noc-client crew --employee-num`, `noc-client crew --name`, and
    `noc-client current-crew`; authenticate first using the same credential and
    base-url inputs as `auth`; print the accepted `noc-client` result model as
    JSON.
  - Verification: `npm run format`, `npm run build`, crew unit tests using
    sample/integration-contract shaped payloads, and crew CLI smoke/unit tests.
  - Commit message:
    ```text
    Add crew identity APIs and CLI
    ```
- [ ] Phase 7.3: `noc-client` Roster convenience APIs and CLI
  - Status: planned, model review required before implementation.
  - Context: Expose public roster client APIs by employee number. The CLI may
    offer current-user convenience, but it must translate that to an
    `employeeNum` before calling client roster APIs. Do not expose public `hrId`
    inputs or outputs. Use `samples/sample.getRoster.json` and
    `samples/sample.getRosterMonthlyAccumulatedValues.json` for model review and
    mapping tests. Local and live sampling found roster detail labels including
    `Activity`, `Station`, `Departure`, `Arrival`, `CheckIn`, `Start`, `End`,
    `CheckOut`, `Aircraft Reg`, `Version`, `Type`, `Crew On Board`,
    `Roster Legal Exception`, `Hotel`, `ReservationNo`, `Comment`,
    `Pickup To Hotel`, `Pickup From Hotel`, `General Note`,
    `Roster Designators`, and `Others who have the same activity`; live sampling
    with `.env` credentials covered May, June, and July 2026 without printing
    credentials or roster values.
  - Proposed model:
    ```ts
    export interface NocRosterOptions {
      readonly month: number;
      readonly year: number;
      readonly employeeNum: string;
    }

    export interface NocRosterResult {
      readonly employeeNum: string;
      readonly date: string;
      readonly crew?: NocCrew;
      readonly days: readonly NocRosterDay[];
      readonly rosterNotes: readonly unknown[];
    }

    export interface NocRosterDay {
      readonly date: string;
      readonly dayNumber: number;
      readonly color?: string;
      readonly departureInfo?: NocRosterDayInfo;
      readonly arrivalInfo?: NocRosterDayInfo;
      readonly hotelInfo?: NocRosterDayInfo;
      readonly activities: readonly NocRosterActivity[];
      readonly notes: readonly unknown[];
    }

    export interface NocRosterDayInfo {
      readonly info?: string;
      readonly details?: string;
      readonly color?: string;
    }

    export interface NocRosterActivity {
      readonly id: number;
      readonly activity: string;
      readonly checkIn?: string;
      readonly std?: string;
      readonly atd?: string;
      readonly dep?: string;
      readonly arr?: string;
      readonly sta?: string;
      readonly ata?: string;
      readonly checkOut?: string;
      readonly info?: string;
      readonly details: NocRosterActivityDetail;
    }

    export interface NocRosterActivityDetail {
      readonly activity?: string;
      readonly station?: NocRosterDetailValue;
      readonly departure?: NocRosterDetailValue;
      readonly arrival?: NocRosterDetailValue;
      readonly checkIn?: string;
      readonly start?: string;
      readonly end?: string;
      readonly checkOut?: string;
      readonly aircraftReg?: string;
      readonly version?: string;
      readonly type?: string;
      readonly crewOnBoard?: readonly NocRosterCrewOnBoard[];
      readonly rosterLegalException?: string;
      readonly hotel?: string;
      readonly reservationNo?: string;
      readonly comment?: string;
      readonly pickupToHotel?: string;
      readonly pickupFromHotel?: string;
      readonly generalNote?: string;
      readonly rosterDesignators?: string;
      readonly othersWhoHaveTheSameActivity?: string;
      readonly [label: string]: unknown;
    }

    export interface NocRosterCrewOnBoard {
      readonly employeeNum: string;
      readonly position: string;
      readonly firstName: string;
      readonly lastName: string;
      readonly email?: string;
      readonly designators: readonly string[];
    }

    export interface NocRosterDetailValue {
      readonly Id?: string;
      readonly Label?: string | null;
      readonly Value?: string;
      readonly Color?: string | null;
      readonly Values?: readonly unknown[];
    }

    export interface NocRosterMonthlyValuesResult {
      readonly employeeNum: string;
      readonly crew?: NocCrew;
      readonly values: readonly NocRosterMonthlyValue[];
    }

    export interface NocRosterMonthlyValue {
      readonly label: string;
      readonly value: string;
    }
    ```
  - Expected behavior: `getRoster()` and `getRosterMonthlyValues()` resolve
    employee number internally, then call `NocBrowser` with a private `hrId`.
    `NocClient` should maintain an internal in-memory `Map<string, number>` for
    employee-number to private-`hrId` resolution; populate it from
    HumanResources rows when available, use it before making mapping requests,
    and fetch HumanResources only when the requested employee number is missing
    from the map. Map roster activity detail arrays into an object keyed by a
    camelCase normalized version of each detail `Label`, using the raw detail
    `Value` as the field value except `Crew On Board`, which should be parsed
    into crew entries with employee number, position, first name, last name,
    email, and parenthesized designators; keep the existing `noc-browser` CLI
    `--employee-num` convenience intact.
  - CLI behavior: add `noc-client roster --month --year --employee-num`,
    `noc-client roster --month --year --current-user`,
    `noc-client roster-monthly-values --month --year --employee-num`, and
    `noc-client roster-monthly-values --month --year --current-user`; use the
    saved `noc-client auth` session and the existing session re-authentication
    behavior; for `--current-user`, the CLI should call `getCurrentCrew()` to
    read the current user's `employeeNum`, then call `getRoster()` or
    `getRosterMonthlyValues()` with that employee number; print the accepted
    `noc-client` result model as JSON.
  - Verification: `npm run format`, `npm run build`, roster mapping/unit tests
    from existing samples, and roster CLI smoke/unit tests.
  - Commit message:
    ```text
    Add roster convenience APIs and CLI
    ```
- [ ] Phase 7.4: `noc-client` Open Time convenience APIs and CLI
  - Status: planned, model review required before implementation.
  - Context: Compose explicit browser Open Time calls at the client layer.
    Browser methods remain raw and separate. Use existing Open Time integration
    contract knowledge for model review until dedicated samples are added.
  - Proposed model:
    ```ts
    export interface NocOpenTimeBase {
      readonly id: number;
      readonly name: string;
      readonly default?: boolean;
    }

    export interface NocOpenTimeUserContextResult {
      readonly isSapOpen: boolean;
      readonly isFirstComeFirstServed: boolean;
      readonly bases: readonly NocOpenTimeBase[];
      readonly defaultBase?: NocOpenTimeBase;
    }

    export interface NocOpenTimeBaseOptions {
      readonly baseId?: number;
      readonly baseName?: string;
      readonly useDefaultBase?: boolean;
    }

    export interface NocOpenTimeRosterOptions extends NocOpenTimeBaseOptions {
      readonly includeLegalityValues?: boolean;
    }

    export interface NocOpenTimePairingsOptions extends NocOpenTimeBaseOptions {
      readonly includeLegalityValues?: boolean;
      readonly includeBlockDetails?: boolean;
    }

    export interface NocOpenTimeActivity {
      readonly id: number;
      readonly activityCode: string;
      readonly date?: string;
      readonly isPairing: boolean;
      readonly rosterRank?: string;
      readonly legalityValues?: readonly NocOpenTimeLegalityValue[];
    }

    export interface NocOpenTimePairing extends NocOpenTimeActivity {
      readonly blockDetails?: readonly NocOpenTimeBlockDetail[];
    }

    export interface NocOpenTimeLegalityValue {
      readonly key: string;
      readonly value: string;
    }

    export interface NocOpenTimeBlockDetail {
      readonly activityId: number;
      readonly assignedPairingId: number;
      readonly activityCode: string;
      readonly dep: string;
      readonly arr: string;
    }
    ```
  - Expected behavior: resolve default base from user context only when client
    options request it; optional legality and block details are client-level
    composed calls; do not add hidden fetching to `noc-browser`.
  - CLI behavior: add `noc-client open-time-user-context`,
    `noc-client open-time-roster`, and `noc-client open-time-pairings` with
    options that match the accepted client APIs, including legality and block
    detail toggles; authenticate first using the same credential and base-url
    inputs as `auth`; print the accepted `noc-client` result model as JSON.
  - Verification: `npm run format`, `npm run build`, Open Time unit tests using
    integration-contract shaped fixtures, and Open Time CLI smoke/unit tests.
  - Commit message:
    ```text
    Add Open Time convenience APIs and CLI
    ```
- [ ] Phase 7.5: `noc-client` Revision model APIs and CLI
  - Status: planned, model review required before implementation.
  - Context: Interpret raw My Revision dynamic day properties into stable client
    sections. Confirmation remains explicit and non-automatic.
  - Proposed model:
    ```ts
    export interface NocRevisionResult {
      readonly revisionAckRequired: boolean;
      readonly revisionAckDetails?: NocRevisionAckDetails;
      readonly days: readonly NocRevisionDay[];
    }

    export interface NocRevisionAckDetails {
      readonly title?: string;
      readonly message?: string;
      readonly confirmButtonPresent: boolean;
    }

    export interface NocRevisionDay {
      readonly date: string;
      readonly notes: readonly string[];
      readonly sections: readonly NocRevisionSection[];
    }

    export interface NocRevisionSection {
      readonly name: string;
      readonly activities: readonly NocRevisionActivity[];
    }

    export interface NocRevisionActivity {
      readonly fields: Readonly<Record<string, string>>;
    }

    export interface NocConfirmRevisionResult {
      readonly confirmed: boolean;
      readonly revisionAckRequired: boolean;
      readonly revisionAckDetails?: NocRevisionAckDetails;
    }
    ```
  - Expected behavior: preserve exact NOC section names in `section.name`; do
    not force semantic names like current/new unless those strings appear in NOC
    text; keep revision confirmation manual and explicit.
  - CLI behavior: add `noc-client revision`, `noc-client revision-status`, and
    `noc-client confirm-revision --confirm`; authenticate first using the same
    credential and base-url inputs as `auth`; never confirm a revision unless
    `--confirm` is present; print the accepted `noc-client` result model as
    JSON.
  - Verification: `npm run format`, `npm run build`, revision mapping/unit
    tests from existing browser test fixtures, and revision CLI smoke/unit
    tests.
  - Commit message:
    ```text
    Add revision model APIs and CLI
    ```
- [ ] Phase 7.6: `noc-client` Station Ops model APIs and CLI
  - Status: planned, model review required before implementation.
  - Context: Interpret raw Station Ops panel maps into stable departure and
    arrival arrays. Use current Station Ops raw parsing and integration
    knowledge for model review.
  - Proposed model:
    ```ts
    export interface NocStationOpsOptions {
      readonly date: StationOpsDateInput;
      readonly stationCode?: string;
      readonly sort?: StationOpsSort;
      readonly timeMode?: StationOpsTimeMode;
      readonly refreshPage?: boolean;
    }

    export interface NocStationOpsResult {
      readonly departures: readonly NocStationOpsDeparture[];
      readonly arrivals: readonly NocStationOpsArrival[];
      readonly panels: readonly NocStationOpsPanel[];
    }

    export interface NocStationOpsPanel {
      readonly label: string;
      readonly rows: readonly NocStationOpsRow[];
    }

    export interface NocStationOpsDeparture {
      readonly flight?: string;
      readonly std?: string;
      readonly atd?: string;
      readonly destination?: string;
      readonly registration?: string;
      readonly gate?: string;
      readonly pax?: string;
      readonly color?: string;
      readonly details: Readonly<Record<string, string>>;
    }

    export interface NocStationOpsArrival {
      readonly flight?: string;
      readonly sta?: string;
      readonly ata?: string;
      readonly origin?: string;
      readonly registration?: string;
      readonly gate?: string;
      readonly pax?: string;
      readonly color?: string;
      readonly details: Readonly<Record<string, string>>;
    }

    export type NocStationOpsRow = NocStationOpsDeparture | NocStationOpsArrival;
    ```
  - Expected behavior: client API accepts `stationCode`, not public
    `stationId`; map known panel labels to `departures` and `arrivals`; keep
    `panels` so unusual NOC labels remain visible.
  - CLI behavior: add `noc-client station-ops --date --station-code` with
    options that match the accepted client API; authenticate first using the
    same credential and base-url inputs as `auth`; print the accepted
    `noc-client` result model as JSON.
  - Verification: `npm run format`, `npm run build`, Station Ops mapping/unit
    tests from existing browser fixtures, and Station Ops CLI smoke/unit tests.
  - Commit message:
    ```text
    Add Station Ops model APIs and CLI
    ```
- [ ] Phase 8.1: Enriched domain service foundation
  - Status: planned, name review required before implementation.
  - Context: Add a post-Phase-7 domain-service package. The final package and
    service name is intentionally deferred; use a neutral working label until
    naming is chosen. This layer is library code first and should be imported by
    future CLI, cron/worker, and Next.js API entrypoints. It owns
    product-specific enrichment, persistence/cache policy, and query-oriented
    outputs. `@scope/noc-client` remains the interpreted NOC client and must not
    own Firebase, cron orchestration, enriched profile reads, FlightAware or
    internal-system merges, or AI-specific query behavior.
  - Proposed model:
    ```ts
    export interface CrewProfile {
      readonly employeeNum: string;
      readonly firstName?: string;
      readonly lastName?: string;
      readonly base?: string;
      readonly position?: string;
      readonly aircraftTypes: readonly string[];
      readonly sources: readonly CrewProfileSource[];
      readonly updatedAt: string;
    }

    export interface CrewProfileSource {
      readonly system: "noc";
      readonly observedAt: string;
      readonly activityId?: number;
      readonly rosterDate?: string;
    }

    export interface CrewProfileStore {
      get(employeeNum: string): Promise<CrewProfile | undefined>;
      getMany(employeeNums: readonly string[]): Promise<ReadonlyMap<string, CrewProfile>>;
      upsert(profile: CrewProfile): Promise<void>;
    }
    ```
  - Expected behavior: create the package boundary, domain-service construction
    pattern, crew profile contracts, store abstraction, and in-memory/fake store
    support for tests. Do not add a Firebase SDK dependency in this phase.
  - Verification: `npm run format`, `npm run build`, and focused unit tests for
    store and service construction behavior.
  - Commit message:
    ```text
    Add enriched domain service foundation
    ```
- [ ] Phase 8.2: Crew profile inference workflow
  - Status: planned, model review required before implementation.
  - Context: Infer crew profile fields that are not reliably available from
    NOC `GetHumanResources`: base, operational position, aircraft type, and
    split first/last names. The workflow should consume `@scope/noc-client`
    roster and crew-on-board APIs once Phase 7 provides stable interpreted
    models.
  - Expected behavior: add a `CrewProfileSyncService` that can iterate selected
    crew members, read their rosters, select a suitable recent activity, fetch
    crew-on-board details, extract the target member's profile fields, record
    provenance, and persist through `CrewProfileStore`. Missing or ambiguous
    data should remain explicit instead of fabricating values.
  - Verification: `npm run format`, `npm run build`, and inference unit tests
    using roster and crew-on-board fixtures for success, missing member,
    missing activity, and ambiguous field scenarios.
  - Commit message:
    ```text
    Add crew profile inference workflow
    ```
- [ ] Phase 8.3: Enriched crew directory queries
  - Status: planned, model review required before implementation.
  - Context: Provide query-oriented enriched crew data by merging live/current
    NOC crew identity data from `@scope/noc-client` with stored crew profile
    data from `CrewProfileStore`.
  - Expected behavior: add methods such as `findCrew`, `getCrewProfile`, and
    `getCrewDirectory`; preserve employee-number and name-search behavior from
    the NOC client where applicable; include profile fields and provenance when
    available; keep missing profile fields explicit.
  - Verification: `npm run format`, `npm run build`, and unit tests for merge
    ordering, missing profiles, stale/provenance fields, and name/employee
    lookup behavior.
  - Commit message:
    ```text
    Add enriched crew directory queries
    ```
- [ ] Phase 8.4: Agent-friendly enriched CLI
  - Status: planned, CLI contract review required before implementation.
  - Context: AI agents should use query-oriented enriched commands rather than
    raw low-level NOC calls. The CLI should import the enriched domain service
    and print stable JSON suitable for tools and agents.
  - Expected behavior: add initial enriched crew commands for crew search and
    crew profile lookup. Commands should use the same domain services as future
    API routes and workers, include profile provenance in JSON output, and keep
    raw NOC-only commands separate from enriched operational commands.
  - Verification: `npm run format`, `npm run build`, CLI unit tests, and JSON
    shape assertions for agent-facing command output.
  - Commit message:
    ```text
    Add enriched crew CLI commands
    ```
- [ ] Later phase: Firebase crew profile store
  - Status: planned, schema review required before implementation.
  - Context: Firebase is the likely production persistence layer for inferred
    crew profile data, but it should remain behind `CrewProfileStore`.
  - Expected behavior: add a Firebase-backed `CrewProfileStore`, production
    configuration loading, serialization/deserialization tests, and migration or
    bootstrap notes for the selected Firebase collection/schema.
  - Verification: `npm run format`, `npm run build`, focused store unit tests,
    and any configured Firebase emulator tests.
  - Commit message:
    ```text
    Add Firebase crew profile store
    ```
- [ ] Later phase: Next.js API integration
  - Status: planned, API contract review required before implementation.
  - Context: A future Next.js backend should expose the same enriched domain
    service used by CLI and workers. HTTP auth, request validation, rate
    limiting, and response transport concerns belong in the API layer, not in
    the domain package.
  - Expected behavior: add API routes for enriched crew search and profile
    lookup, using the shared domain service and `CrewProfileStore`; keep route
    responses aligned with the CLI/domain JSON contracts where practical.
  - Verification: `npm run format`, `npm run build`, API route tests, and
    contract tests for response shapes.
  - Commit message:
    ```text
    Add enriched crew API routes
    ```
- [ ] Future improvement

## Done
- [x] Phase 6.1 follow-up: Revision raw result shape 
cleanup
  - Branch: `phase-6.1-raw-results`.
  - Context: Changed My Revision raw parsing to expose NOC section header text as dynamic day keys and activity rows as
    field-only header/value objects. Removed semantic `revision/current` bucketing, flat `activities`, legacy activity
    metadata, and section-name canonicalization from the public raw shape.
  - Files: `packages/noc-browser/src/noc-revision-page.ts`, `packages/noc-browser/src/index.ts`,
    `packages/noc-browser/test/unit/revision.test.ts`, `packages/noc-browser/test/integration/revision.test.ts`,
    `packages/noc-browser/test/manual/acknowledge-revision.manual.ts`, `.agents/AGENTS.md`,
    `docs/architecture/overview.md`, `.agents/tasks.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 55 unit tests; `npm run test:integration`
    passed with 7 live integration tests; `npm run build` passed. Live tests did not confirm revision acknowledgement.
- [x] Phase 6.1: Raw Result browser contract
  - Branch: `phase-6.1-raw-results`.
  - Context: Refactored `@rhanna/noc-browser` public return contracts to use
    `ResultRaw` naming for raw JSON-compatible browser outputs, reserving
    unsuffixed `Result` names for semantically interpreted `noc-client`
    structures.
  - Files: browser output/export types, unit/integration tests,
    `.agents/AGENTS.md`, `docs/architecture/overview.md`, `.agents/tasks.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 52
    unit tests; `npm run test:integration` passed with 7 live integration tests;
    `npm run build` passed. Live tests did not confirm revision acknowledgement.
- [x] Phase 6: `noc-browser` Station Operations
  - Context: Implemented page-backed Station Operations with cached form state,
    exact NOC form posts, date formatting, station ID/code selection, structured
    departure/arrival header and detail fields, header color preservation, and
    revision-ack handling.
  - Files: `packages/noc-browser/src/noc-station-ops.ts`,
    `packages/noc-browser/src/noc-browser.ts`,
    `packages/noc-browser/src/index.ts`,
    `packages/noc-browser/test/unit/station-ops.test.ts`,
    `packages/noc-browser/test/integration/station-ops.test.ts`,
    `docs/architecture/overview.md`.
  - Verification: focused Station Ops unit test passed with 8 tests; focused
    Station Ops live integration test passed using cached and refreshed page
    state; `npm run format` passed; `npm run test:unit` passed with 51 unit
    tests; `npm run test:integration` passed with 7 live integration tests;
    `npm run build` passed. Live tests did not confirm revision acknowledgement.
- [x] Phase 5: `noc-browser` Open Time APIs
  - Context: Implemented low-level Open Time JSON API calls with explicit methods
    for roster legality values, pairing legality values, and pairing block
    details instead of boolean include options.
  - Files: `packages/noc-browser/src/noc-open-time.ts`,
    `packages/noc-browser/src/noc-browser.ts`,
    `packages/noc-browser/src/index.ts`,
    `packages/noc-browser/test/unit/open-time.test.ts`,
    `packages/noc-browser/test/integration/open-time.test.ts`,
    `docs/architecture/overview.md`.
  - Verification: focused Open Time unit test passed with 9 tests; focused Open
    Time integration test passed; `npm run format` passed; `npm run test:unit`
    passed with 43 unit tests; `npm run test:integration` passed with 6 live
    integration tests; `npm run build` passed. Live tests did not confirm
    revision acknowledgement.
- [x] Strengthen Roster integration contract tests
  - Context: Replaced weak live Roster API object checks with shape and invariant
    assertions for current user, human resources, roster, monthly accumulated
    values, and crew-on-board details.
  - Files: `packages/noc-browser/test/integration/roster.test.ts`,
    `.agents/tasks.md`.
  - Verification: focused Roster integration test passed; `npm run format`
    passed; `npm run test:unit` passed with 34 unit tests; `npm run
    test:integration` passed with 5 live integration tests; `npm run build`
    passed. Live tests did not confirm revision acknowledgement.
- [x] Merge duplicate Roster option types
  - Context: Used `NocRosterOptions` for both `getRoster()` and
    `getRosterMonthlyAccumulatedValues()` instead of maintaining an identical
    monthly-specific options type.
  - Files: `packages/noc-browser/src/noc-roster.ts`,
    `packages/noc-browser/src/noc-browser.ts`,
    `packages/noc-browser/src/index.ts`, `.agents/tasks.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 34
    unit tests; `npm run build` passed.
- [x] Phase 4: `noc-browser` Roster APIs
  - Context: Completed the low-level Roster WebMethod group by adding human
    resources, current user, roster, and crew-on-board calls alongside the
    existing Roster monthly accumulated values API.
  - Files: `packages/noc-browser/src/noc-roster.ts`,
    `packages/noc-browser/src/noc-browser.ts`,
    `packages/noc-browser/src/index.ts`,
    `packages/noc-browser/test/unit/roster.test.ts`,
    `packages/noc-browser/test/integration/roster.test.ts`,
    `docs/architecture/overview.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 34
    unit tests; `npm run test:integration` passed with 5 live integration tests;
    `npm run build` passed. Live tests did not confirm revision
    acknowledgement.
- [x] Rename monthly accumulated values module to Roster
  - Context: Renamed the just-added module, public method, exported types,
    tests, fixture, documentation, and task references to Roster wording.
  - Files: `packages/noc-browser/src/noc-roster.ts`,
    `packages/noc-browser/src/noc-browser.ts`,
    `packages/noc-browser/src/index.ts`,
    `packages/noc-browser/test/unit/roster.test.ts`,
    `packages/noc-browser/test/integration/roster.test.ts`,
    `samples/sample.getRosterMonthlyAccumulatedValues.json`,
    `docs/architecture/overview.md`, `.agents/tasks.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 28
    unit tests; `npm run test:integration` passed with 5 live integration tests;
    `npm run build` passed.
- [x] Add missing Roster monthly accumulated values API
  - Context: Implemented the low-level Roster
    `GetMonthlyAccumulatedValues` WebMethod from the HAR and aligned workspace
    scripts/dependencies with the renamed `@rhanna/noc-browser` package.
  - Files: `packages/noc-browser/src/noc-roster.ts`,
    `packages/noc-browser/src/noc-browser.ts`,
    `packages/noc-browser/src/index.ts`,
    `packages/noc-browser/test/unit/roster.test.ts`,
    `packages/noc-browser/test/integration/roster.test.ts`,
    `package.json`, `package-lock.json`, `packages/noc-client/package.json`,
    `docs/architecture/overview.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 28
    unit tests; `npm run test:integration` passed with 5 live integration tests;
    `npm run build` passed.
- [x] Phase 3: `noc-browser` revision APIs
  - Context: Implemented `NocRevisionPage`, fresh My Revision retrieval,
    content-based revision acknowledgement checks, confirm-post verification,
    and low-level revision day parsing.
  - Files: `packages/noc-browser/src/**`,
    `packages/noc-browser/test/unit/revision.test.ts`,
    `packages/noc-browser/test/integration/revision.test.ts`,
    `docs/architecture/overview.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 19
    unit tests; `npm run test:integration` passed with 4 live integration tests,
    including My Revision load/status without live confirmation; `npm run build`
    passed.
- [x] Add dotenv loading for integration tests
  - Context: Integration tests now load `.env.test.local`, `.env.test`, and
    `.env` without overriding existing shell variables.
  - Files: `packages/noc-browser/vitest.integration.config.ts`,
    `.env.test.example`, `package.json`, `package-lock.json`.
  - Verification: `npm run format` passed; `npm run test:integration` passed.
- [x] Phase 2: `noc-browser` authentication and revision detection
  - Context: Implemented `authenticate(username, password)`, failed-login parsing,
    content-based active revision acknowledgement detection, and revision-ack
    result/error exports.
  - Files: `packages/noc-browser/src/**`, `packages/noc-browser/test/**`,
    `docs/architecture/overview.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 13
    unit tests; `npm run test:integration` passed with default-page and invalid
    login live tests, and skipped valid-credential auth because
    `NOC_USERNAME`/`NOC_PASSWORD` were not set; `npm run build` passed.
- [x] Rename abstract browser classes
  - Context: Renamed public abstract classes from `AbstractNocBrowserClient` to
    `AbstractBrowser` and from `AbstractNocBrowserPage` to `AbstractBrowserPage`;
    aligned internal module filenames.
  - Files: `packages/noc-browser/src/**`, `packages/noc-browser/test/**`,
    `docs/architecture/overview.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed; `npm run
    build` passed.
- [x] Phase 1: Workspace scaffold and abstract browser core
  - Context: Created npm workspace packages for `noc-browser`, `noc-client`, and
    `noc-cli`; implemented reusable low-level browser/page primitives for ASP.NET
    Web Forms and JSON WebMethods.
  - Files: root workspace config, package configs, `packages/noc-browser/src/**`,
    `packages/noc-browser/test/**`, placeholder client/cli packages,
    `docs/architecture/overview.md`.
  - Verification: `npm run format` passed; `npm run test:unit` passed with 7
    unit tests; `npm run test:integration` passed with the live unauthenticated
    `/Default.aspx` smoke test; `npm run build` passed for all workspaces.
- [x] Completed task

---

Convention: when starting a task, move it to Active and add relevant context.
When done, move it to Done with verification notes.
