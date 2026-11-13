import { noHandRolledBase64Rule } from '#oxlint-plugin/rules/quality/base64'
import { preferEsToolkitRule } from '#oxlint-plugin/rules/quality/es-toolkit'
import { noUnvalidatedJSONParseRule } from '#oxlint-plugin/rules/quality/json-parse'
import { noReduceAccumulatorCopyRule } from '#oxlint-plugin/rules/quality/reduce-accumulator-copy'
import { noRawRuntimeEffectRule } from '#oxlint-plugin/rules/quality/runtime-effect'
import { noSpreadArgumentsRule } from '#oxlint-plugin/rules/quality/spread-arguments'
import { valibotSchemaConventionsRule } from '#oxlint-plugin/rules/quality/valibot-schemas'
import { noRawSQLRule } from '#oxlint-plugin/rules/sql'
import { definePlugin } from '@oxlint/plugins'

/** OpenPencil's validation and data rules, named `@open-pencil/data/<rule>`. Every rule is off until a configuration turns it on. */
export default definePlugin({
  meta: { name: '@open-pencil/data' },
  rules: {
    'no-hand-rolled-base64': noHandRolledBase64Rule,
    'no-raw-runtime-effect': noRawRuntimeEffectRule,
    'no-raw-sql': noRawSQLRule,
    'no-reduce-accumulator-copy': noReduceAccumulatorCopyRule,
    'no-spread-arguments': noSpreadArgumentsRule,
    'no-unvalidated-json-parse': noUnvalidatedJSONParseRule,
    'prefer-es-toolkit': preferEsToolkitRule,
    'valibot-schema-conventions': valibotSchemaConventionsRule
  }
})
