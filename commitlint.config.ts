import isIgnored from '@commitlint/is-ignored'
import type { UserConfig } from '@commitlint/types'

import { hasAICoauthor, noAICoauthors } from './tools/ci/policy/src/commit-attribution'

// `Release vX.Y.Z` or `Release vX.Y.Z-beta.N`, plus the ` (#N)` the merge queue's squash appends.
const RELEASE_TITLE = /^Release v\d+\.\d+\.\d+(?:-beta\.[1-9]\d*)?(?: \(#\d+\))?$/

export default {
  extends: ['@commitlint/config-conventional'],
  // Apply attribution policy before allowing generated-message or release exceptions.
  defaultIgnores: false,
  plugins: [{ rules: { 'no-ai-coauthors': noAICoauthors } }],
  rules: {
    'no-ai-coauthors': [2, 'always'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'build', 'ci', 'chore']
    ],
    // Product names such as MCP, DOM/CSS, and Kiwi retain their casing.
    'subject-case': [0],
    'scope-case': [0],
    'body-max-line-length': [0],
    'footer-max-line-length': [0]
  },
  ignores: [
    (message) =>
      !hasAICoauthor(message) &&
      (RELEASE_TITLE.test(message.split('\n')[0] ?? '') ||
        (process.env.COMMITLINT_PR_TITLE !== '1' && isIgnored(message)))
  ],
  helpUrl: 'https://github.com/aliaaldihnayn-lab/design/blob/master/CONTRIBUTING.md#commit-messages'
} satisfies UserConfig
