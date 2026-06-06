# Tasks

## Active
- None

## Backlog
- [ ] Future improvement

## Done
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
