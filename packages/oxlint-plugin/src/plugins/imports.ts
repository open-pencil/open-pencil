import {
  noCwdRelativePaths,
  noDeepParentRelativeImports,
  noDeepParentRelativePaths,
  noFunctionAliasImports
} from '#oxlint-plugin/rules/imports'
import { definePlugin } from '@oxlint/plugins'

/** OpenPencil's imports and paths rules, named `@open-pencil/imports/<rule>`. Every rule is off until a configuration turns it on. */
export default definePlugin({
  meta: { name: '@open-pencil/imports' },
  rules: {
    'no-cwd-relative-paths': noCwdRelativePaths,
    'no-deep-parent-relative-imports': noDeepParentRelativeImports,
    'no-deep-parent-relative-paths': noDeepParentRelativePaths,
    'no-function-aliases': noFunctionAliasImports
  }
})
