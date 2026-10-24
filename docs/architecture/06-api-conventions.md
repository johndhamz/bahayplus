# 06 · API Conventions

There are two **adapters** over the same application services. Both validate with the same Zod contracts from `src/contracts`.

| Adapter                    | Consumer                                        | Location                       |
| -------------------------- | ----------------------------------------------- | ------------------------------ |
| Server Actions             | Web portals (forms, mutations)                  | `src/modules/<m>/actions.ts`   |
| Route Handlers `/api/v1/*` | Future React Native app, integrations, webhooks | `src/app/api/v1/**/route.ts`   |
| Internal job endpoints     | pg_cron / Vercel Cron                           | `src/app/api/internal/jobs/**` |

Reads in web portals go Server Component → module query service directly (no HTTP hop).

## Contracts

```ts
// src/contracts/pets/create-pet.ts
export const CreatePetInput = z.object({
  householdId: Uuid,
  name: z.string().trim().min(1).max(80),
  species: PetSpecies,
  birthDate: IsoDate.optional(),
});
export type CreatePetInput = z.infer<typeof CreatePetInput>;
export const PetDto = z.object({
  id: Uuid,
  householdId: Uuid,
  name: z.string(),
  species: PetSpecies,
  birthDate: IsoDate.nullable(),
  createdAt: IsoDateTime,
});
```

- Contracts are the **only** shape shared with clients; DB row types never leak past repositories.
- Output DTOs are validated in tests (and in development at runtime) to catch drift.

## Result & errors

Application services return `Result<T, AppError>` instead of throwing for expected failures.

```ts
type AppError =
  | { code: "VALIDATION_FAILED"; issues: FieldIssue[] }
  | { code: "UNAUTHENTICATED" }
  | { code: "FORBIDDEN" }
  | { code: "NOT_FOUND"; resource: string }
  | { code: "CONFLICT"; reason: string } // e.g. invalid state transition
  | { code: "IDEMPOTENCY_MISMATCH" }
  | { code: "RATE_LIMITED"; retryAfterSeconds: number }
  | { code: "DEPENDENCY_FAILED"; dependency: string }
  | { code: "INTERNAL" };
```

HTTP mapping: 400/422 validation · 401 · 403 · 404 · 409 conflict/idempotency · 429 · 502 dependency · 500.

REST error envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Name is required.",
    "issues": [{ "path": ["name"], "message": "Required" }],
    "requestId": "req_01J…"
  }
}
```

`message` is user-safe; internal details are logged with `requestId`, never returned. `NOT_FOUND` is also returned for resources in other tenants (no existence leaks).

## REST style (`/api/v1`)

| Concern           | Convention                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resources         | Plural nouns, nested by tenant: `/api/v1/households/{householdId}/pets/{petId}`                                                                                                                                                                             |
| Actions           | State transitions as sub-resources: `POST /bookings/{id}/confirm`, not `PATCH status`                                                                                                                                                                       |
| Casing            | JSON `camelCase`; query params `camelCase`                                                                                                                                                                                                                  |
| Timestamps        | ISO 8601 UTC with `Z` (`2026-10-24T03:00:00Z`); date-only `YYYY-MM-DD` (Manila calendar date)                                                                                                                                                               |
| Money             | `{ "amountCentavos": 150000, "currency": "PHP" }` — integer, never decimal strings or floats                                                                                                                                                                |
| Pagination        | Cursor: `?limit=25&cursor=…` → `{ data: [...], nextCursor: string \| null }`; max limit 100                                                                                                                                                                 |
| Filtering/sorting | `?status=confirmed&sort=-createdAt` with an allow-list per endpoint                                                                                                                                                                                         |
| Versioning        | Path (`/v1`). Additive changes only within a version                                                                                                                                                                                                        |
| Idempotency       | `Idempotency-Key` header **required** on POSTs that create bookings, quotations acceptances, payment records, stock movements; optional elsewhere. Same key + same body → stored response; same key + different body → 409 `IDEMPOTENCY_MISMATCH`. TTL 24 h |
| Concurrency       | Mutable resources return `version` (or `updatedAt`); updates send `If-Match` / `expectedVersion`; mismatch → 409                                                                                                                                            |
| Request ID        | `x-request-id` accepted/generated and echoed                                                                                                                                                                                                                |
| Rate limits       | Per-IP and per-user on auth, search, urgent requests                                                                                                                                                                                                        |
| Auth              | Cookie session (web) or `Authorization: Bearer` (mobile). Unauthenticated → 401 JSON, never an HTML redirect                                                                                                                                                |

## Route handler skeleton

```ts
export const POST = defineRoute({
  auth: "required",
  idempotent: true,
  params: z.object({ householdId: Uuid }),
  body: CreatePetInput.omit({ householdId: true }),
  response: PetDto,
  handler: ({ ctx, params, body }) => pets.createPet(ctx, { ...body, householdId: params.householdId }),
});
```

`defineRoute` builds `RequestContext`, parses input, applies idempotency, maps `Result` to HTTP, and attaches `requestId`. An OpenAPI document is generated from the contracts (`zod` → OpenAPI) for the mobile team.

## Server Action conventions

- One file per module, `'use server'` at top, each action: `parse → buildContext → service → revalidatePath/Tag → return ActionResult`.
- Return `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }` so React Hook Form can map field errors.
- Never trust hidden form fields for tenant IDs without re-authorizing in the service.

## Webhooks (payments, SMS delivery)

`/api/v1/webhooks/{provider}` — signature verified by the provider adapter, event stored first (dedup by provider event id), then processed asynchronously by the job runner.
