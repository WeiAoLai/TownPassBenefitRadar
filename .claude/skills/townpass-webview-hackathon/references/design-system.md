# Verified design system

These values were read from Figma page `1:2` on 2026-10-25. Do not extend the scales by interpolation.

## Figma tool routing

The verified tables below are the offline baseline. Do not require a Figma connection for ordinary implementation when these values are sufficient.

Use the connected Figma tool when the task requires any of the following:

- implementing or reviewing a specific screen, component instance, variant, or state;
- resolving a value not present in this reference;
- checking whether the source file changed after the inspection date;
- refreshing typography, colors, spacing, component behavior, or responsive layout from the source.

Read the smallest relevant node first. Use page `1:2` only for discovery, then inspect the exact node listed in `source-of-truth.md`. Record the file URL, node ID, inspected value, and date when updating this reference or project tokens.

If the Figma tool is unavailable or the file cannot be accessed, continue only with values already verified here. Mark missing design decisions as unverified and ask for access when they block the requested implementation. Never estimate a token from a screenshot or substitute a visually similar value.

## Typography

Figma declares PingFang for Chinese and Roboto for English and numerals. Use a font stack that preserves those priorities and provides system fallbacks. The token table uses 0% letter spacing.

| Token | Size | Line height | Weight | Intended use |
|---|---:|---:|---:|---|
| `font-H1-regular` | 36 | 48 | 400 | Emphasized text |
| `font-H1-semibold` | 36 | 48 | 600 | Emphasized text |
| `font-H2-regular` | 24 | 32 | 400 | Page title |
| `font-H2-semibold` | 24 | 32 | 600 | Page title |
| `font-H3-regular` | 16 | 22 | 400 | Section title, card title, result |
| `font-H3-semibold` | 16 | 22 | 600 | Section title, card title, result |
| `font-Body-regular` | 14 | 20 | 400 | Lists, Dialog text, errors, main body |
| `font-Body-semibold` | 14 | 20 | 600 | Emphasized body text |
| `font-Caption-regular` | 12 | 18 | 400 | Figma says to avoid when possible |

Do not use the presentation text’s own font weight as the token definition when it conflicts with the table label. For example, the Body Regular row is rendered with a semibold table sample, but the published token name and weight column say Regular.

## Main colors

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Primary | `#EDF8FA` | `#DBF1F5` | `#B4E2EA` | `#93D4DF` | `#71C5D5` | `#5AB4C5` | `#468D9B` | `#356C77` | `#22474E` | `#112629` | `#081315` |
| Secondary | `#FDF8ED` | `#FCF2DF` | `#F8E3BC` | `#F4D69E` | `#F0C87C` | `#F5BA4B` | `#E7A43C` | `#AD7B2B` | `#74521B` | `#3C2B0B` | `#1C1304` |
| Grey | `#F1F3F4` | `#E3E7E9` | `#CAD1D5` | `#ADB8BE` | `#91A0A8` | `#738995` | `#5E6D76` | `#475259` | `#30383D` | `#171B1D` | `#0B0D0E` |

Additional values explicitly shown in Figma:

- `color-Red/300`: `#E29494`
- `color-Red/500`: `#D45251`
- `color-Orange/300`: `#F4B992`
- `color-Orange/500`: `#FD853A`
- `color-Green/500`: `#76A732`

The Flutter repo defines broader Red and Orange scales, but Figma does not publish the full scales on this page. Do not use unlisted steps in a web design unless the current target node or a user-approved requirement verifies them.

## Token implementation

Use semantic aliases in components and keep raw palette values in one place.

```css
:root {
  --tp-color-primary-500: #5ab4c5;
  --tp-color-grey-800: #30383d;
  --tp-color-red-500: #d45251;
  --tp-font-h2-size: 24px;
  --tp-font-h2-line-height: 32px;
  --tp-font-body-size: 14px;
  --tp-font-body-line-height: 20px;
}
```

Do not assign a semantic role such as error, disabled, or surface from visual similarity alone. Inspect Figma node `3:390` or the exact component instance and record the mapping.

## Component constraints

- Figma medium button examples are 48 px high; large buttons are 56 px high.
- Maintain at least 48 × 48 for all interactive hit targets, even when the visible icon is smaller.
- Use the Figma component states for default, hover/pressed, disabled, error, and focus. WebView touch interaction still needs visible keyboard focus.
- Use the Top navigation component family as the visual reference. Each route must expose a unique `document.title`; the Flutter host uses page title changes for its AppBar unless a forced title is supplied.
- Verify responsive behavior in the actual project. The kit’s 375/395 px examples are references, not a license to hard-code one viewport.
