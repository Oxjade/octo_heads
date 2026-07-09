# Design

## Theme

Ink CrossMint uses a restrained dark product interface: pure near-black architecture, rose-red Ink actions, pale text, and small semantic status accents. The physical scene is a secure signing console in a dim hardware lab: polished, minimal, and exact.

## Color Tokens

Use OKLCH tokens only.

```css
:root {
  --bg: oklch(0.075 0 0);
  --surface: oklch(0.125 0.006 330);
  --surface-2: oklch(0.172 0.01 330);
  --line: oklch(0.31 0.015 330);
  --ink: oklch(0.955 0.004 330);
  --muted: oklch(0.705 0.018 330);
  --primary: oklch(0.63 0.18 333);
  --primary-strong: oklch(0.55 0.2 333);
  --accent: oklch(0.72 0.13 32);
  --success: oklch(0.68 0.12 165);
  --warning: oklch(0.75 0.14 80);
  --danger: oklch(0.62 0.18 25);
}
```

## Typography

Use a single product sans stack: Inter when available, then system UI. Product headings are firm and compact, not oversized. Body copy targets 65-75ch, labels and data use tabular numerals where useful.

## Components

Components share one vocabulary: 10-12px radii for panels, 8px for buttons and inputs, 1px borders, visible focus outlines, and consistent state colors. Cards are used for actual items, dashboards, status panels, and modals, not for every page section.

## Layout

Desktop uses a constrained 1180px content width with full-width dark bands. Mobile prioritizes the wallet/session state, then the mint action, then details. Dashboards use dense but scannable two-column layouts that collapse to one column.

## Motion

Motion is limited to state feedback, subtle entrance of critical panels, and transaction step updates. Durations stay around 160-240ms with reduced-motion alternatives.
