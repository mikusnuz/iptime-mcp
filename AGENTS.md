# iptime-mcp contributor instructions

## Project scope

This repository implements a local stdio MCP server for ipTIME router administration. Keep the server transport-focused, auditable, and safe around network-changing operations. Do not add unrelated applications, generated reports, work logs, or scratch artifacts.

## Required checks

Run these commands after code changes:

```sh
npm run lint
npm test
npm run build
```

Run `npm pack --dry-run` after changing package metadata, entry points, build output, or public documentation. Tests must use loopback mock servers; never use a real router for automated write tests.

## Code map

- `src/server.ts`: MCP tools, resources, schemas, and server instructions
- `src/catalog.ts`: fixed operation catalog, risk classification, readbacks, and parameter hints
- `src/router.ts`: router selection, sessions, capability checks, and read/write dispatch
- `src/plans.ts`: immutable expiring write plans, confirmation, attachment hashing, and verification
- `src/transport.ts`: bounded HTTP transport, cookies, redirects, and response parsing
- `src/security.ts`: target classification, TLS fingerprint checks, and same-origin validation
- `src/adapters/`: iUX3 and legacy protocol adapters
- `src/config.ts`: single-router and multi-router environment configuration
- `src/sanitize.ts`: recursive secret redaction
- `tests/`: loopback-only Node test suite

## Safety invariants

- Never accept router credentials as MCP tool arguments. Read them only from process environment configuration.
- Never print, return, fixture, or commit real credentials, session cookies, DDNS hostnames, public router URLs, backups, firmware images, or user-specific paths.
- Keep public-address plain HTTP blocked by default. Do not weaken redirect, same-origin, DNS, timeout, or response-size checks.
- Do not expose a direct router-write tool. Every write must pass through an immutable plan. Never require the user to copy a confirmation token or repeat a plan id.
- Treat a specific user request for the same operation and parameters as authorization. For critical-risk plans not already explicitly authorized, request a normal natural-language confirmation after presenting the risk.
- Do not automatically retry writes after authentication, timeout, transport, or response ambiguity. Reconcile with a readback where possible.
- Classify operations conservatively. Connectivity-affecting, destructive, credential, certificate, restore, reset, reboot, firmware, and storage-format actions must not be downgraded.
- Configuration backups must remain non-overwriting, owner-readable only, size-bounded, and ignored by version control.
- All MCP output must pass through `sanitize`.

## Catalog changes

- Add methods only with evidence from an ipTIME interface bundle, a real capability response, or reproducible firmware behavior.
- Keep operation names unique and stable. Preserve the distinction between router method names and public operation names.
- Mark action-like and shared config methods as writes even when the underlying endpoint name looks like a getter.
- Add a readback for a write only when invoking the readback without write parameters is known to be safe.
- Record non-object parameter shapes in `paramsHint`; add `defaultParams` only when the default is verified across applicable calls.
- Update catalog tests and the documented totals when the operation count changes.

## Adapter rules

- iUX3 may use `api/has` only to verify methods already present in the fixed catalog; do not turn arbitrary router methods into callable operations.
- Legacy interfaces expose only explicitly mapped reads. Do not guess legacy writes from CGI names or form fields.
- Preserve browser-compatible headers required by iUX3 and the bounded lenient HTTP parser used for malformed legacy firmware responses.

## Repository hygiene

- Keep `.env`, router `.config` backups, firmware `.bin` files, package archives, logs, editor state, caches, `node_modules`, and `dist` out of Git.
- Keep `README.md`, `README.ko.md`, `llms.txt`, and the usage templates synchronized with the actual tool surface and environment variables.
- Do not include assistant attribution, generated-by notices, agent transcripts, or unrelated trailers in source files or commit messages.
- Do not create commits, tags, releases, or pushes unless the user explicitly requests them.
