# Monitoring and alerting

| Signal                | Source                                                                                                                           | Alert when                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Availability          | Uptime monitor (Better Stack, UptimeRobot) on `GET /api/health` every minute from Singapore                                      | 2 consecutive failures or `status != ok`                         |
| App errors            | Vercel logs plus error tracking (Sentry recommended, decision Q8). Server actions log `[jobs]` and `[payments]` prefixes         | Error rate > 1% for 5 min; any `[payments]` error                |
| Database              | Supabase reports: CPU, connections, slow queries (`pg_stat_statements`)                                                          | CPU > 80% for 10 min; connections > 80% of pool                  |
| Auth                  | Supabase Auth logs                                                                                                               | Spike in failed sign-ins (credential stuffing)                   |
| Notification delivery | `select status, count(*) from notification_deliveries where created_at > now() - interval '1 hour' group by 1;`                  | `failed` > 5% or `queued` older than 15 min                      |
| Background jobs       | `private.job_runs` (daily jobs), `private.job_failures`, `cron.job_run_details`                                                  | Any failed daily run; any job_failures row                       |
| Payments (once live)  | `payment_events` with `payment.amount_mismatch`; reconciliation runs with mismatches; `private.webhook_events` outcome `ignored` | Any mismatch; webhook 4xx spike (possible secret rotation issue) |
| Performance           | Vercel Speed Insights / Web Vitals (LCP, INP, CLS by device); CI `npm run test:perf` budgets                                     | p75 LCP > 2.5 s on mobile                                        |

Operational queries are safe to run in the Supabase SQL editor as `postgres`. The admin console (Overview) also shows pending verifications, open disputes and failed notifications for the last 7 days.

Logs never include tokens, passwords, webhook payload secrets or full contact details. Keep it that way when adding logging.
