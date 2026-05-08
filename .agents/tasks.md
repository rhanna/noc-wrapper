# Tasks

## Active
- [ ] None

## Backlog
- [ ] Future improvement

## Done
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
