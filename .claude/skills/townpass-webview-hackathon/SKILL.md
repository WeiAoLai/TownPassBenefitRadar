---
name: townpass-webview-hackathon
description: Build, adapt, integrate, review, and document Taipei TownPass WebView microservices for hackathons using the official Flutter host contract, optional Vue starter, Figma UI kit, accessibility rules, and competition deliverables. Use for TownPass or 台北城市通 WebView projects; do not use for unrelated web apps or change the native TownPass protocol without explicit authorization.
---

# TownPass WebView Hackathon Development

Create a mobile-first web microservice that runs correctly in the TownPass Flutter WebView, follows the verified design system, reduces barriers for people using older or lower-resource devices, passes the 12 accessibility categories, and ships with a complete README.

## Source priority

1. Treat the user’s current project and explicit requirements as the target.
2. For a named competition, use its current official rules for submission, licensing, maps, AI, deployment, and presentation constraints. Do not carry one year’s rules into another year.
3. Use the specified Figma file for web typography, colors, components, and visual behavior.
4. Use the official `taipei-doit/TownPass` repo and TownPass guideline for the WebView protocol and host behavior.
5. Use example repositories only for README organization and useful evidence, not as architecture requirements.

Never invent a token, bridge method, payload, return value, dependency version, or accessibility exception. If sources conflict, show the conflict and ask only when it changes the implementation. Otherwise prefer the source assigned above and record the decision.

Read [references/source-of-truth.md](references/source-of-truth.md) before starting or auditing a project.

## Workflow

1. Inspect the current repo before editing. Locate its framework, package manager, lockfile, routes, state, styles, bridge code, tests, README, and any local TownPass checkout. Preserve the established structure unless the user asks for migration.
2. Determine whether the work targets a specific competition. For the 2026 Taipei Fall TownPass hackathon, read [references/event-2026-fall.md](references/event-2026-fall.md) and refresh mutable rules from the current organizer source before enforcing them.
3. The WebView frontend may use another suitable framework. If starting from the official Vue microservice approach, use Node.js 18 or newer, Vue 3 Composition API, Vue Router, Pinia, Tailwind CSS, `v-calendar`, and Headless UI Dialog. Preserve the project’s actual package manager; the official starter uses `pnpm install`, `pnpm dev`, and `http://localhost:5173`.
4. Before styling or generating UI, read [references/design-system.md](references/design-system.md). Encode the verified Figma values as project tokens, then map components to those tokens. Use the connected Figma tool only when implementing an exact Figma node, refreshing the snapshot, or resolving missing or conflicting values. Do not sample colors from screenshots or infer missing values.
5. Before calling native features, read [references/webview-bridge.md](references/webview-bridge.md). Keep browser-only development safe when `window.flutterObject` is absent. Do not fabricate native success in production code.
6. If the work adds the service to the TownPass app, changes a native capability, or creates a custom handler, read [references/host-integration.md](references/host-integration.md). Do not modify the host merely to avoid implementing a web fallback.
7. Read [references/accessibility.md](references/accessibility.md) before implementing UI and again before acceptance testing. Apply all 12 categories, including the 48 × 48 target and 200% text check. Also run the checklist in [references/ncc-app-accessibility-2017.md](references/ncc-app-accessibility-2017.md), the NCC 2017 Taiwanese mobile app accessibility guideline mapped to WebView practice; cite its item numbers when documenting Taiwan compliance, and never implement the obsolete techniques it names.
8. Before choosing browser features, asset formats, animation, or large dependencies, read [references/device-compatibility.md](references/device-compatibility.md). Preserve the core flow on older or lower-resource hardware through feature detection, progressive enhancement, restrained payloads, and resilient network states.
9. Verify every dataset name, field, update frequency, URL, and license from its publisher. Mark fixtures and mock data explicitly. For competition maps or AI, apply the current event-specific restrictions rather than a previous project’s provider or model.
10. Implement the smallest end-to-end user flow first. Add loading, empty, error, offline, permission-denied, and cancellation states where the feature can reach them.
11. Test in a mobile browser viewport, then in the actual TownPass WebView on iOS and Android when both are in scope. Include a representative older or lower-resource device when available. Browser emulation is supporting evidence, not proof of device or bridge compatibility.
12. Run the project’s formatter, lint, typecheck, unit tests, production build, accessibility checks, relevant end-to-end tests, and the compatibility checks required by the documented support baseline. Fix failures introduced by the work. Record commands and results.
13. Create or update `README.md` from [assets/README.template.md](assets/README.template.md). Remove unused sections and all placeholders before delivery.

## Official Vue starter structure

When using the official Vue approach and the repo has no stronger convention:

- `src/assets`: images and static UI assets.
- `src/views`: route-level Vue components.
- `src/components`: reusable UI components; keep responsibilities small.
- `src/css`: global styles, fonts, and verified design tokens.
- `src/stores`: Pinia stores for shared state.
- `src/router`: Vue Router configuration.
- `src/composables`: bridge and reusable stateful logic.
- `public`: large static files and mock data that must be served unchanged.

For another framework, preserve its established equivalent separation rather than creating empty Vue directories.

Keep secrets out of client bundles. Any client-exposed environment value, including `VITE_*`, is public after build; proxy secret-bearing APIs through a backend.

## Acceptance contract

A finished task must provide evidence for:

- Production build succeeds.
- Every native call uses the verified `{ name, data }` JSON string contract.
- Reply listeners are registered before sending and removed when no longer needed.
- When host integration is in scope, the service is launched from its real TownPass entry and its `destinationUrl`, title behavior, back navigation, close action, and native permissions are verified.
- Each route has a meaningful `document.title`, one clear page heading, and a logical focus order.
- Interactive targets are at least 48 × 48 in the rendered WebView.
- Keyboard-only navigation, visible focus, Dialog focus management, and no keyboard trap are verified.
- Content remains usable at 200% text size and across the supported viewport widths and orientations.
- The README states the verified OS/WebView support baseline and the devices or constrained profiles actually tested; untested hardware is not claimed as supported.
- The core flow remains usable without optional animation or unsupported enhancement APIs, and handles slow, unstable, or interrupted networks without trapping the user.
- Initial loading avoids unnecessary large dependencies, media, and continuous background work that disproportionately affects older or lower-memory devices.
- Every production dataset and third-party package has a verified source and license; mock data is visibly identified.
- Competition-specific map, AI, licensing, publication, and submission requirements are checked against the current event source and documented separately from permanent TownPass behavior.
- The NCC 2017 APP accessibility checklist is reviewed, including explained permission requests with a manual fallback (1.1), a manual override for every automatic interface mode (1.3), zoom-enabled viewport (3.3), no `eval()` on external data (5.3), and per-view URLs with working Back (5.4).
- Meaningful images have alternatives; decorative images are hidden from assistive technology.
- Motion, dynamic updates, notifications, validation errors, and loading states are announced or controllable as required.
- README documents setup, environment variables, architecture, feature/data sources, third-party licenses, bridge and host integration, testing, accessibility, deployment, licensing, AI use when present, and acknowledgments.

When reviewing an existing project, report failures with file and line evidence. Do not claim compliance from code inspection alone when the rule requires runtime or assistive-technology testing.
