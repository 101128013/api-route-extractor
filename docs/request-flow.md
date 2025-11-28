## Existing Request & Auth Flow Summary

### Request Execution Path
- `components/EndpointCard.tsx` expands each endpoint with a “Request Builder” powered by `RequestEditor`.
- When the panel opens it parses `endpoint.example.request.curl` via `utils/curlParser.parseCurlCommand` to prefill method/url/headers/body.
- Variable interpolation is manual: any `{{VAR}}` tokens are replaced via `resolveVariables`, pulling from the active environment (`App.tsx` passes `variables` from `EnvironmentManager`).
- Request send action (`handleRunRequest`) performs:
  1. Resolve URL/body/header variables.
  2. Validate URL is absolute, otherwise errors out (requires user/manual set).
  3. Apply enabled auth configs (see below).
  4. Strip `content-length` to avoid browser override.
  5. Always proxy through `/proxy?url=...` to bypass CORS, using `fetch` with the composed method/headers/body.
  6. Collect response metadata (status/text/headers/duration) and surface in UI.
  7. Forward execution record to `onRequestExecuted`, which `App.tsx` wires to history/tests.

### RequestEditor Capabilities
- Tabs for Params/Headers/Body with simple key/value tables.
- Params re-write the URL locally but do not expose dedicated query builder for relative+absolute simultaneously.
- Bodies support raw free-form text only (no form-data, x-www-form-urlencoded, or file helpers).
- No method selector (inherits from parsed cURL or endpoint definition), so switching verbs requires editing cURL upstream.

### History & Testing Hooks
- `App.tsx` supplies `handleRequestExecuted` to `EndpointCard`.
- Handler creates `RequestHistoryItem` (see `types.ts`) with request/response/env metadata and saves via `HistoryService.addHistoryItem`.
- If tests exist (`TestService.getTestsForEndpoint`), they run after a successful response; results are attached to the same history entry.
- History and Test panels (modals) are separate components opened from EndpointCard buttons; they do not integrate into the request editor itself yet.

### Authentication Helpers
- `services/AuthService.ts` persists configs in `localStorage` (`api-extractor-auth-configs`).
- Supported types: bearer, apiKey (header/query/cookie), basic, oauth2, digest (placeholder), custom script.
- During send, EndpointCard pulls **all enabled configs** (not scoped to endpoint/env) and sequentially applies them to the request via `AuthService.applyAuthToRequest`.
- OAuth2 helpers expose refresh/exchange utilities but there is no UI automation hooking them into request execution.
- Auth context is separated from environments—`AuthManager` modal can attach configs to an `environmentId`, yet apply logic ignores the active environment selection (needs enhancement).

### Identified Gaps for Workbench
- Request editing UI lacks method picker, structured body modes, tabbed response viewer, or environment preview.
- Auth application is global; no per-request toggle, recommendation, or quick injection hints based on `endpoint.authType`.
- No reusable request templates/snippets; history is passive (cannot load entry directly into editor).
- Proxy/send logic lives inside `EndpointCard`, preventing reuse by other components (new workbench should centralize it).


