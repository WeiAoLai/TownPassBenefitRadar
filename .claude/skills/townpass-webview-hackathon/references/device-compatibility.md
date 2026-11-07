# Device compatibility and digital inclusion

TownPass is a public-service surface. Treat reliable access on older or lower-resource devices and slow networks as part of digital inclusion, not as an optional performance polish.

## Establish the support baseline

Derive the baseline from the current TownPass host repo, organizer requirements, and the actual deployment environment. Record the minimum supported OS, the embedded WebView or WKWebView behavior, and the TownPass version when they can be verified. Do not invent a browser-version matrix from framework defaults.

If no authoritative minimum is available, document that gap. Test the oldest representative devices available to the team and describe the result as observed coverage, not a universal support claim.

## Implementation rules

- Keep the core task usable with semantic HTML, ordinary navigation, and broadly supported CSS before optional enhancements load.
- Detect required APIs at runtime. Add a focused fallback or polyfill only when it preserves a required core flow without imposing disproportionate cost on every device.
- Avoid dependencies, media, icon packs, and font files that are not needed for the initial route. Split route-level code and defer nonessential work.
- Serve appropriately sized images, reserve their layout space, and provide a conservative fallback when a newer image format is used.
- Avoid continuous animation, autoplay, large blur effects, oversized shadows, polling loops, and background work with no user-visible value. Respect reduced-motion preferences.
- Keep event listeners and timers bounded and remove them when views unmount. Paginate or virtualize genuinely long lists after checking that accessibility is preserved.
- Make loading, retry, offline, timeout, and interrupted-response states usable. Do not leave the user in an indefinite spinner or discard entered form data after a recoverable network failure.
- Do not use device age, memory, network quality, or missing optional capabilities to deny the core service when a simpler path can work.

## Verification

Test the complete core flow in the actual TownPass WebView on a representative older or lower-resource device when one is available. Record device model, OS version, WebView version when observable, network condition, date, and result.

When hardware is unavailable, use browser CPU and network throttling as an early warning check. Label it as simulation; it does not verify memory pressure, thermal throttling, operating-system behavior, or the native bridge.

At minimum, verify and record:

- production bundle and major initial-route asset sizes;
- cold-load and core-interaction behavior under a constrained network and CPU profile;
- absence of crashes, frozen controls, unbounded loading, and unrecoverable network states in the tested environment;
- the behavior when optional animation or enhancement APIs are unavailable;
- that 200% text, assistive technology, and 48 × 48 targets remain usable on the constrained viewport.

Prefer measured results over universal numeric budgets unless the organizer or project defines a budget. A task is not complete when it claims old-device support without naming the baseline and evidence used.
