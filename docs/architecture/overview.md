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

## Package Boundaries

Phase 1 only implements reusable browser primitives. NOC authentication, revision handling, domain APIs, normalization,
formatting, and CLI behavior are intentionally deferred to later phases.
