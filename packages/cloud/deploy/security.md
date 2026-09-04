# Backend security checks

OpenPencil Cloud combines static analysis, runtime integration tests, and supply-chain checks. These checks complement code review; they do not replace authorization and abuse-case testing.

## Local checks

Run the normal quality gate:

```sh
bun run check
```

Cloud-specific validation:

```sh
bun --filter @open-pencil/cloud check
bun --filter @open-pencil/cloud test:e2e
```

Dependency auditing:

```sh
bun run check:audit       # Fails on critical advisories
bun run check:audit:high  # Reports the current high-severity backlog
bun run check:cloud-policy # Runs project-specific Semgrep rules in Docker
```

The high-severity audit is initially informational in CI because existing transitive dependencies have unresolved advisories. New dependency work should not increase that backlog. Promote it to a required check once the recorded findings are remediated or explicitly accepted.

## Enforced Cloud lint policy

Cloud source and deployment adapters enable additional type-aware Oxlint rules for unsafe assignment, arguments, calls, member access, and returns, plus exhaustive switches and deprecated API detection.

The Cloud TypeScript project also enables:

- `noUncheckedIndexedAccess`
- `noImplicitOverride`
- `useUnknownInCatchVariables`
- `noFallthroughCasesInSwitch`

These settings are intentionally stricter than the repository baseline because Cloud handles authentication, bearer capabilities, database writes, and object-storage credentials.

## CI security analysis

- **CodeQL** runs JavaScript/TypeScript `security-extended` and `security-and-quality` queries.
- **actionlint** validates workflow syntax and expressions.
- **zizmor** audits high-confidence, high-severity GitHub Actions issues.
- **Dependabot** monitors npm, Cargo, Docker, and GitHub Actions dependencies.

Existing workflow-security findings must be remediated before the zizmor job can become required. In particular, migrate third-party actions to commit-SHA references, move dynamic expressions out of shell bodies, and narrow release workflow permissions to individual jobs.

## Planned checks

The next hardening layers are project-specific Semgrep policies, container image scanning/SBOM generation, property-based authorization tests, and API fuzzing against the Compose deployment.
