# Accessibility acceptance guide

Apply all 12 TownPass categories. The checks below translate the supplied requirements and official guideline into web implementation work.

For Taiwan-specific mobile guidance, also apply the item-by-item mapping in [ncc-app-accessibility-2017.md](ncc-app-accessibility-2017.md) (NCC 2017 APP 無障礙開發指引). Where it is stricter or more specific, follow it; where it names an obsolete technique, follow the replacement listed there.

## AT: alternatives

- Give meaningful `img` and icon-only controls concise alternatives that describe purpose.
- Use empty `alt` or `aria-hidden="true"` for decorative images and icons.
- Do not convey status only by color, shape, position, or an image of text.
- Test the accessibility tree, not only the visible label.

## AV: timed media

- Do not autoplay audio or video.
- Provide captions, transcripts, audio description, and independent controls when the project includes media.
- Ensure media audio does not mask screen-reader output.

## NT: notifications

- Use `role="status"` or a suitable `aria-live` region for non-blocking updates.
- Use `role="alert"` for urgent errors without moving focus unnecessarily.
- Dialogs need an accessible name, focus entry, contained keyboard navigation, Escape/close behavior when allowed, and focus restoration.

## TS: touch

- Make every interactive target at least 48 × 48 in the rendered WebView. Expand the hit area around small icons.
- Trigger primary actions on release/click, not pointer-down.
- Provide a single-pointer alternative for path or multi-touch gestures.

## FC: focus

- Use native interactive elements whenever possible.
- DOM and focus order must follow top-to-bottom, left-to-right reading order.
- Show a visible focus indicator and never create a keyboard trap.
- Insert new actionable content immediately after its trigger in the logical order or deliberately move focus with an announcement.

## FM: forms

- Associate every control with a visible `label`; instructions and errors must be programmatically connected.
- Set appropriate `type`, `inputmode`, `autocomplete`, constraints, and accessible error text.
- Group related fields with `fieldset` and `legend` when applicable.
- Do not change focus or context merely because the user typed or selected a value.
- In portrait layouts, place labels above fields; in wider layouts, keep visual proximity and reading order.

## LK: links

- Link text must identify its destination or action without surrounding context.
- Combine an image and its adjacent label into one link instead of creating duplicate focus stops.
- Do not reuse vague labels such as 「更多」 for different destinations without an accessible name that distinguishes them.

## DC: dynamic content

- Never flash content three or more times per second.
- Give users a way to pause, stop, hide, or control moving and auto-updating content.
- Respect `prefers-reduced-motion` and keep necessary state changes understandable without animation.
- Announce async results without unexpectedly refreshing the page or moving focus.

The official accessibility page notes that the existing TownPass home carousel does not meet its DC2 and DC4 examples. Do not copy that exception into new work.

## ST: structure

- Each route needs a unique, clear `document.title` and one primary heading.
- Keep heading levels and landmarks meaningful.
- Align the route title with the host AppBar title unless the native route intentionally forces a title.

## AD: adaptability

- Preserve logical content order across viewport sizes, orientation changes, zoom, safe areas, and assistive technology.
- Avoid fixed-height containers that clip translated, enlarged, or wrapped text.
- Support both portrait and landscape unless the user supplies a documented product constraint.

The official page says the current native TownPass layout is portrait-only. Treat that as a documented limitation, not permission for a new WebView to ignore adaptation.

## DT: distinguishability

- Keep text and controls readable at 200% text size without lost content or function.
- Do not disable pinch zoom or force a maximum scale of 1.
- Verify text, icons, boundaries, and state indicators against the applicable contrast requirement. Use measured colors from the rendered state.
- Ensure links and controls are visually distinguishable from surrounding text.

## PD: predictability

- Set the page language and mark language changes.
- Keep repeated navigation in the same relative order.
- Use the same icon, accessible name, and behavior for the same function throughout the project.

## Required manual checks

Test keyboard-only operation, VoiceOver or TalkBack where available, 200% text, portrait and landscape, smallest supported width, Dialog focus, dynamic announcements, reduced motion, and each native bridge permission/cancellation path. Automated tools support this work but do not replace it.
