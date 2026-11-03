import {
  noDeepParentRelativeImports,
  noDeepParentRelativePaths,
  noFunctionAliasImports
} from '#oxlint-plugin/rules/imports'
import { noMixedCaseAcronymIdentifiers } from '#oxlint-plugin/rules/naming'
import { noHandRolledBase64Rule } from '#oxlint-plugin/rules/quality/base64'
import { preferEsToolkitRule } from '#oxlint-plugin/rules/quality/es-toolkit'
import { noUnvalidatedJSONParseRule } from '#oxlint-plugin/rules/quality/json-parse'
import { noModuleMockingRule } from '#oxlint-plugin/rules/quality/module-mocking'
import { noReduceAccumulatorCopyRule } from '#oxlint-plugin/rules/quality/reduce-accumulator-copy'
import { valibotSchemaConventionsRule } from '#oxlint-plugin/rules/quality/valibot-schemas'
import { noWidenThenAssertRule } from '#oxlint-plugin/rules/quality/widen-then-assert'
import {
  noConditionalObjectSpreads,
  noMathRandom,
  noReflectDeleteGlobalThisOutsideTests,
  noSilentCatch
} from '#oxlint-plugin/rules/runtime'
import {
  noDynamicHTMLRule,
  noSecretInQueryRule,
  noSecretLoggingRule
} from '#oxlint-plugin/rules/security'
import { noRawSQLRule } from '#oxlint-plugin/rules/sql'
import {
  noSiblingDomainPrefixedFiles,
  noUselessPassThroughWrappers
} from '#oxlint-plugin/rules/structure'
import {
  noBroadDoubleCast,
  noBroadUnknownTypeAssertions,
  noDuplicateTypeShapes,
  noFunctionType,
  noImportTypeAnnotations,
  noTsSuppressionComments,
  noUnknownRecordDoubleCast
} from '#oxlint-plugin/rules/typescript'
import { definePlugin } from '@oxlint/plugins'

/**
 * OpenPencil's code conventions as Oxlint rules, named `open-pencil/<rule>`. Every rule is off
 * until a configuration turns it on.
 */
const plugin = definePlugin({
  meta: { name: 'open-pencil' },
  rules: {
    'no-broad-double-cast': noBroadDoubleCast,
    'no-broad-unknown-type-assertions': noBroadUnknownTypeAssertions,
    'no-conditional-object-spreads': noConditionalObjectSpreads,
    'no-deep-parent-relative-imports': noDeepParentRelativeImports,
    'no-deep-parent-relative-paths': noDeepParentRelativePaths,
    'no-duplicate-type-shapes': noDuplicateTypeShapes,
    'no-dynamic-html': noDynamicHTMLRule,
    'no-function-alias-imports': noFunctionAliasImports,
    'no-function-type': noFunctionType,
    'no-hand-rolled-base64': noHandRolledBase64Rule,
    'no-import-type-annotations': noImportTypeAnnotations,
    'no-math-random': noMathRandom,
    'no-mixed-case-acronym-identifiers': noMixedCaseAcronymIdentifiers,
    'no-module-mocking': noModuleMockingRule,
    'no-raw-sql': noRawSQLRule,
    'no-reduce-accumulator-copy': noReduceAccumulatorCopyRule,
    'no-reflect-delete-global-this-outside-tests': noReflectDeleteGlobalThisOutsideTests,
    'no-secret-in-query': noSecretInQueryRule,
    'no-secret-logging': noSecretLoggingRule,
    'no-sibling-domain-prefixed-files': noSiblingDomainPrefixedFiles,
    'no-silent-catch': noSilentCatch,
    'no-ts-suppression-comments': noTsSuppressionComments,
    'no-unknown-record-double-cast': noUnknownRecordDoubleCast,
    'no-unvalidated-json-parse': noUnvalidatedJSONParseRule,
    'no-useless-pass-through-wrappers': noUselessPassThroughWrappers,
    'no-widen-then-assert': noWidenThenAssertRule,
    'prefer-es-toolkit': preferEsToolkitRule,
    'valibot-schema-conventions': valibotSchemaConventionsRule
  }
})

export default plugin
