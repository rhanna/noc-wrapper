# Architecture Overview

This repository is an npm workspace with three packages:

- `@scope/noc-browser`: implemented low-level browser/client package for direct NOC portal interactions.
- `@scope/noc-client`: placeholder package reserved for higher-order normalized convenience APIs.
- `@scope/noc-cli`: placeholder package reserved for the command-line app.

## `@scope/noc-browser`

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

`NocBrowser.authenticate(username, password)` performs the low-level NOC login flow:

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

## Package Boundaries

`@scope/noc-browser` currently implements reusable browser primitives plus low-level authentication/revision-ack detection.
Domain APIs, normalization, formatting, and CLI behavior are intentionally deferred to later phases.
