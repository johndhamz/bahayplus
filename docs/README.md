# Bahay+ Architecture Documentation

> **Bahay+** — _Everything home. One app._
> A Philippines-first Household Operating System and Service Marketplace.

| #   | Document                                                            | What it answers                                                  |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 01  | [Architecture overview](./architecture/01-overview.md)              | System shape, runtime topology, cross-cutting concerns           |
| 02  | [Repository structure](./architecture/02-repository-structure.md)   | Where code lives and the import rules between layers             |
| 03  | [Domain modules](./architecture/03-domain-modules.md)               | The 16 approved domains, their boundaries and dependencies       |
| 04  | [Data model](./architecture/04-data-model.md)                       | Core entities, relationships, conventions for money/time/tenancy |
| 05  | [Authentication & authorization](./architecture/05-auth.md)         | Identity, contexts, roles, permissions, RLS strategy             |
| 06  | [API conventions](./architecture/06-api-conventions.md)             | Server Actions, REST `/api/v1`, errors, pagination, idempotency  |
| 07  | [Testing strategy](./architecture/07-testing-strategy.md)           | Unit, integration, RLS, E2E, accessibility, CI gates             |
| 08  | [Implementation phases](./architecture/08-implementation-phases.md) | Phase plan with scope and exit criteria                          |
| 09  | [Risks & open decisions](./architecture/09-risks-and-decisions.md)  | Technical risks, mitigations, decisions needing an owner         |

## Scope guardrails

**Approved domains (16):** authentication & authorization · household & property · household members & permissions · asset registry · pets · vehicles · bills & utilities · budgeting & expenses · calendar & reminders · home services marketplace · provider trust & verification · urgent provider discovery · bookings/quotations/appointments/work orders · renovation & custom projects · supplier/inventory/logistics · business & administrative operations.

**Not approved (do not build without explicit approval):** standalone Digital Home Vault · rental/tenant management · family tasks & chores · shared household expenses · recurring service payments · direct utility bill payments · cashback & rewards · in-app messaging · referral & rewards.

**Future (interface only):** Bahay+ Wallet — PHP-only stored value via a licensed partner. No balances, top-ups, transfers, withdrawals or wallet payments are implemented. See [04 › Payments](./architecture/04-data-model.md#payments-and-the-future-wallet).

## How these documents evolve

- Each phase updates the documents it touches in the same pull request as the code.
- Architectural decisions that change a documented rule are recorded in [09 › Decision log](./architecture/09-risks-and-decisions.md#decision-log).
