import { noWidenThenAssertRule } from '#oxlint-plugin/rules/quality/widen-then-assert'
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

/** OpenPencil's types and assertions rules, named `@open-pencil/types/<rule>`. Every rule is off until a configuration turns it on. */
export default definePlugin({
  meta: { name: '@open-pencil/types' },
  rules: {
    'no-broad-double-cast': noBroadDoubleCast,
    'no-broad-unknown-assertions': noBroadUnknownTypeAssertions,
    'no-duplicate-shapes': noDuplicateTypeShapes,
    'no-function-type': noFunctionType,
    'no-import-type-annotations': noImportTypeAnnotations,
    'no-suppression-comments': noTsSuppressionComments,
    'no-unknown-record-double-cast': noUnknownRecordDoubleCast,
    'no-widen-then-assert': noWidenThenAssertRule
  }
})
