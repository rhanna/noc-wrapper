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
    export interface NocCrewMember {
      readonly employeeNumber?: string;
      readonly displayName: string;
      readonly firstName?: string;
      readonly lastName?: string;
      readonly status?: string;
    }

    export interface NocCurrentCrewMemberResult {
      readonly crewMember: NocCrewMember;
    }

    export interface NocCrewListResult {
      readonly crew: readonly NocCrewMember[];
    }

    export interface NocCrewLookupOptions {
      readonly employeeNumber: string;
    }

    export interface NocCrewLookupResult {
      readonly crewMember: NocCrewMember;
    }
    ```
  - Expected behavior: add `getCrew()`, `getCurrentCrewMember()`, and
    `getCrewMemberByEmployeeNumber()`; support employee-number candidates from
    `EmpNo`, `EmployeeNum`, `EmployeeNumber`, and leading digits in
    `DisplayName`; handle no match, duplicate match, invalid employee number,
    and missing valid private `Id`.
  - CLI behavior: add `noc-client crew`, `noc-client current-crew`, and
    `noc-client crew-member --employee-num`; authenticate first using the same
    credential and base-url inputs as `auth`; print the accepted `noc-client`
    result model as JSON.
  - Verification: `npm run format`, `npm run build`, crew unit tests using
    sample/integration-contract shaped payloads, and crew CLI smoke/unit tests.
  - Commit message:
    ```text
    Add crew identity APIs and CLI
    ```
- [ ] Phase 7.3: `noc-client` Roster convenience APIs and CLI
  - Status: planned, model review required before implementation.
  - Context: Expose roster APIs only by employee number or current user. Do not
    expose public `hrId` inputs or outputs. Use `samples/sample.getRoster.json`
    and `samples/sample.getRosterMonthlyAccumulatedValues.json` for model
    review and mapping tests.
  - Proposed model:
    ```ts
    export type NocRosterTarget =
      | { readonly currentUser: true }
      | { readonly employeeNumber: string };

    export interface NocRosterOptions {
      readonly month: number;
      readonly year: number;
      readonly target: NocRosterTarget;
    }

    export interface NocRosterResult {
      readonly username?: string;
      readonly date: string;
      readonly target: NocRosterResolvedTarget;
      readonly days: readonly NocRosterDay[];
      readonly notes: readonly unknown[];
    }

    export interface NocRosterResolvedTarget {
      readonly kind: "currentUser" | "employeeNumber";
      readonly employeeNumber?: string;
      readonly crewMember?: NocCrewMember;
    }

    export interface NocRosterDay {
      readonly date: string;
      readonly dayNumber: number;
      readonly color?: string;
      readonly isCurrentDay: boolean;
      readonly departure?: NocRosterDayInfo;
      readonly arrival?: NocRosterDayInfo;
      readonly hotel?: NocRosterDayInfo;
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
      readonly state?: string;
      readonly validFrom?: string;
      readonly validFromUtc?: string;
      readonly validTo?: string;
      readonly validToUtc?: string;
      readonly details: readonly NocRosterActivityDetail[];
    }

    export interface NocRosterActivityDetail {
      readonly id?: string;
      readonly label: string;
      readonly value: unknown;
      readonly color?: string;
      readonly values: readonly unknown[];
    }

    export interface NocRosterMonthlyValuesResult {
      readonly target: NocRosterResolvedTarget;
      readonly values: readonly NocRosterMonthlyValue[];
    }

    export interface NocRosterMonthlyValue {
      readonly label: string;
      readonly value: string;
    }
    ```
  - Expected behavior: `getRoster()` and `getRosterMonthlyValues()` resolve
    current user or employee number internally, then call `NocBrowser` with a
    private `hrId`; keep the existing `noc-browser` CLI `--employee-num`
    convenience intact.
  - CLI behavior: add `noc-client roster --month --year --employee-num`,
    `noc-client roster --month --year --current-user`, and
    `noc-client roster-monthly-values --month --year --employee-num|--current-user`;
    authenticate first using the same credential and base-url inputs as `auth`;
    print the accepted `noc-client` result model as JSON.
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
