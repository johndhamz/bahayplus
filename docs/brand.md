# Bahay+ brand identity

Source artwork lives in [`logo/`](../logo/): the brand identity sheet, the primary app icon (`bahayplusicon.png`) and a glow render for marketing. In the product, the logo is drawn by `apps/web/components/brand/logo.tsx` (SVG mark plus live-text wordmark) so it is crisp at every size and themeable.

## Logo

| Lockup               | Component                             | Use                                                             |
| -------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Horizontal (primary) | `<Logo />`                            | Headers, emails, documents. Add `tagline` where there's room.   |
| Stacked              | `<Logo layout="stacked" />`           | Square or narrow spaces, splash and hero areas.                 |
| Mark only            | `<LogoMark />`                        | Compact UI (collapsed sidebar), favicons, avatars.              |
| App-icon tile        | `<LogoTile />`                        | Places that echo the installed app icon.                        |
| Home link            | `<BrandMark />` (`components/layout`) | Navigation: the logo wrapped in a home link, sized for headers. |

Tones: `brand` (light surfaces: gold house, green cross, green wordmark), `inverse` (green or dark surfaces: gold house, white cross, white wordmark), `mono-dark` and `mono-light` (single colour).

- **Wordmark:** lowercase "bahay" in Plus Jakarta Sans 800 with tight tracking, plus the accent "+". Screen readers hear "Bahay+".
- **Tagline:** "Everything home. One app." with wide letter spacing (0.22em).
- **Clear space:** at least the height of the house mark on every side.
- **Minimum size:** horizontal logo 120 px wide (web); mark or app icon 24 px.
- Don't recolour the mark outside the four tones, stretch it, add effects, or put the green version on busy photos.

## Colour

| Role       | Hex       | Token                  | Character                   |
| ---------- | --------- | ---------------------- | --------------------------- |
| Primary    | `#153D35` | `--brand` / `bg-brand` | Trust, stability, home      |
| Accent     | `#E5C584` | `--gold` / `bg-gold`   | Warmth, premium, positive   |
| Background | `#F6F3EB` | `--background`         | Clean, modern, approachable |
| Secondary  | `#E0E9E2` | `--sage` / `bg-sage`   | Calm, supportive, balanced  |

Terracotta (`#C57A59`) remains a supporting UI colour for alerts and emphasis. It is not a logo colour. Gold on cream is decorative only. Never use it for body text, because it fails contrast.

## App icons

Generated from `logo/bahayplusicon.png` by `scripts/generate-icons.py`: PWA 192/512 (transparent corners), maskable 512 and Apple touch 180 (full-bleed), and the favicon. The sheet's light app icon (cream background, green house, gold plus) is reserved for future store listings and light launcher themes.

## Social

`app/opengraph-image.tsx` renders the 1200×630 share card (stacked mark plus wordmark on primary green).
