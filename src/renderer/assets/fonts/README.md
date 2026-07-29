# Bundled typefaces

Geist and Geist Mono, shipped with the app rather than fetched at runtime.
A desktop tool that loses its typeface when the network is down is not a
desktop tool — before 2026-07-29 these came from the Google Fonts CDN and the
whole interface fell back to a system face offline.

| File | Family | Subset |
|---|---|---|
| `geist-latin.woff2` | Geist | latin |
| `geist-latin-ext.woff2` | Geist | latin-ext |
| `geist-mono-latin.woff2` | Geist Mono | latin |
| `geist-mono-latin-ext.woff2` | Geist Mono | latin-ext |

All four are **variable** fonts covering weights 100–900, which is why four
files cover every weight the design uses. Together they are ~82 KB.

Only the Latin subsets are here. Neither family contains Hangul, so Korean text
renders in the system face either way — carrying the Cyrillic, Greek and
Vietnamese subsets would add weight nothing in this app can use.

Source: Google Fonts (Geist v5, Geist Mono v6). Licensed under the
SIL Open Font License 1.1 — see `LICENSE.txt`.

To refresh, take the `latin` and `latin-ext` `@font-face` blocks from
`https://fonts.googleapis.com/css2?family=Geist:wght@100..900` (and
`Geist+Mono`) and re-download the `woff2` each one points at. Keep the
`unicode-range` values in `styles/global.css` in step with them.
