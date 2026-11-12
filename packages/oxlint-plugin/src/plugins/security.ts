import {
  noDynamicHTMLRule,
  noSecretInQueryRule,
  noSecretLoggingRule,
  noUnvalidatedRouteParamsRule
} from '#oxlint-plugin/rules/security'
import { definePlugin } from '@oxlint/plugins'

/** OpenPencil's security rules, named `@open-pencil/security/<rule>`. Every rule is off until a configuration turns it on. */
export default definePlugin({
  meta: { name: '@open-pencil/security' },
  rules: {
    'no-dynamic-html': noDynamicHTMLRule,
    'no-secret-in-query': noSecretInQueryRule,
    'no-secret-logging': noSecretLoggingRule,
    'no-unvalidated-route-params': noUnvalidatedRouteParamsRule
  }
})
