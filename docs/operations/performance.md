# Performance notes (Phase 11)

Target: mid-range Android (for example a Snapdragon 6-series with 4–6 GB RAM) on Philippine mobile data. Budgets enforced in CI (`npm run test:perf`): **≤ 450 KB compressed JS** and **LCP < 4 s** under 4× CPU throttling, 150 ms RTT and 1.6 Mbps down.

Measured on 2026-10-25 against a local production build (`tests/performance/mobile-budgets.spec.ts`):

| Page                | JS transferred (compressed) | LCP    | Notes                                     |
| ------------------- | --------------------------- | ------ | ----------------------------------------- |
| `/` (cold)          | 189 KB                      | ~1.0 s | First visit, empty cache                  |
| `/login`            | 0 KB new                    | ~0.1 s | Shared chunks cached from the first visit |
| Household dashboard | 0 KB new                    | ~0.4 s | Signed in, server-rendered                |
| Bills               | 0 KB new                    | ~0.3 s | Server-rendered                           |

These are local-network numbers with emulated throttling. Production adds real RTT to Vercel `sin1` and Supabase Singapore; monitor real-user p75 with Vercel Speed Insights.

## What keeps it fast

- **Server rendering by default.** Pages are React Server Components; client components are small islands (forms, dialogs). Charts are hand-written SVG, with no chart library.
- **Fonts** are self-hosted with `next/font` and `display: swap`. There are no third-party scripts.
- **The service worker** caches content-hashed `/_next/static` assets cache-first, so repeat visits download almost no JavaScript.
- **Pagination and limits:** every list query is bounded (`limit` 50–200; provider search pages of 12; audit log pages of 50). Unbounded selects are not used.
- **Database:** composite tenant keys, RLS helper functions marked `stable`, and indexes on hot paths (migration `…001300_performance_indexes.sql`, chosen from a foreign-key index audit). Columns used only for auditing (`created_by`, `decided_by`, …) are intentionally unindexed to keep writes cheap; add indexes if user-deletion cascades become slow.
- **Images:** portfolio images are lazy-loaded (`loading="lazy"`). Uploads are capped at 10 MB, and private files use short-lived signed URLs (never cached by the service worker).

## Known gaps

- No image resizing pipeline for uploaded photos (Supabase image transformations or a CDN would help on slow networks).
- Measurements are synthetic. Real-device testing on 3G/4G in provincial areas is still to do.
