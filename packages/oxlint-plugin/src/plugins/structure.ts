import { noMixedCaseAcronymIdentifiers } from '#oxlint-plugin/rules/naming'
import {
  noSiblingDomainPrefixedFiles,
  noUselessPassThroughWrappers
} from '#oxlint-plugin/rules/structure'
import { definePlugin } from '@oxlint/plugins'

/** OpenPencil's naming and file layout rules, named `@open-pencil/structure/<rule>`. Every rule is off until a configuration turns it on. */
export default definePlugin({
  meta: { name: '@open-pencil/structure' },
  rules: {
    'no-mixed-case-acronym-identifiers': noMixedCaseAcronymIdentifiers,
    'no-sibling-domain-prefixed-files': noSiblingDomainPrefixedFiles,
    'no-useless-pass-through-wrappers': noUselessPassThroughWrappers
  }
})
