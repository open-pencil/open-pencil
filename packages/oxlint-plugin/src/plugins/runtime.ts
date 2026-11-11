import { noModuleMockingRule } from '#oxlint-plugin/rules/quality/module-mocking'
import {
  noConditionalObjectSpreads,
  noMathRandom,
  noReflectDeleteGlobalThisOutsideTests,
  noSilentCatch
} from '#oxlint-plugin/rules/runtime'
import { definePlugin } from '@oxlint/plugins'

/** OpenPencil's runtime behaviour and errors rules, named `@open-pencil/runtime/<rule>`. Every rule is off until a configuration turns it on. */
export default definePlugin({
  meta: { name: '@open-pencil/runtime' },
  rules: {
    'no-conditional-object-spreads': noConditionalObjectSpreads,
    'no-math-random': noMathRandom,
    'no-module-mocking': noModuleMockingRule,
    'no-reflect-delete-global-this-outside-tests': noReflectDeleteGlobalThisOutsideTests,
    'no-silent-catch': noSilentCatch
  }
})
