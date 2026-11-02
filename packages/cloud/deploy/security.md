# Backend security checks

OpenPencil Cloud handles authentication, bearer capabilities, database writes, and object-storage
credentials, so it is held to stricter checks than the rest of the repository. They complement code
review; they do not replace authorization and abuse-case testing.

## Local checks

```sh
bun run test:cloud                       # type-check, unit, and PGlite integration tests
bun --filter @open-pencil/cloud test:e2e # Docker Compose end-to-end suite
bun run check:audit                      # fails on critical dependency advisories
bun run check:secrets                    # Gitleaks over the working tree
```

## Stricter lint and types

`oxlint.json` turns on type-aware rules for `packages/cloud/src`: no unsafe assignment, argument,
call, member access, or return of `any`, exhaustive switches, and no deprecated APIs. The package
`tsconfig.json` adds `noUncheckedIndexedAccess`, `noImplicitOverride`,
`useUnknownInCatchVariables`, and `noFallthroughCasesInSwitch`.

## Properties the code relies on

- Lookups of private resources do not reveal whether the resource exists.
- Every request body and every response the client reads is validated with Valibot.
- Capability secrets and invitation tokens are stored as SHA-256 digests and compared in constant
  time; they travel in URL fragments, never in paths or query strings.
- OAuth continuations for invitations are single-use compact JWE.
- Technical limits stay in force even if entitlement or policy data is wrong.
- Presigned object transfers are separate from authenticated API requests.
