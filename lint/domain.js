// Oxlint loads one plugin per domain, named `@open-pencil/<domain>`: the published rules from
// packages/oxlint-plugin and the rules only this repository needs from tools/checks/lint, both
// read from source.
import { domains } from '../tools/checks/lint/src/domains.ts'

export function domainPlugin(domain, published = { rules: {} }) {
  return {
    meta: { name: `@open-pencil/${domain}` },
    rules: { ...published.rules, ...domains[domain] }
  }
}
