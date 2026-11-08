// Oxlint loads one `open-pencil` plugin: the published rules from packages/oxlint-plugin and the
// rules only this repository needs from tools/checks/lint, both read from source.
import shared from '../packages/oxlint-plugin/src/index.ts'
import repository from '../tools/checks/lint/src/plugin.ts'

export default {
  meta: { name: 'open-pencil' },
  rules: { ...shared.rules, ...repository.rules }
}
