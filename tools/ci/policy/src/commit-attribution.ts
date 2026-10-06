import { execFileSync } from 'node:child_process'

import type { SyncRule } from '@commitlint/types'

// Match tool identities, not people's names or entire vendor domains.
const AI_COAUTHOR_EMAILS = new Set([
  'noreply@anthropic.com',
  'noreply@openai.com',
  'codex@openai.com',
  'noreply@cursor.com',
  'noreply@cursor.sh',
  'gemini-cli@google.com',
  '175728472+copilot@users.noreply.github.com'
])
const AI_GITHUB_EMAIL =
  /^(?:\d+\+)?(?:claude|copilot|codex|cursoragent|gemini-code-assist|chatgpt-codex-connector)\[bot\]@users\.noreply\.github\.com$/i

export function hasAICoauthor(message: string): boolean {
  // Git distinguishes real trailers from quoted examples and ordinary body text.
  const trailers = execFileSync('git', ['interpret-trailers', '--parse'], {
    input: message,
    encoding: 'utf8'
  })
  return trailers.split('\n').some((line) => {
    const value = /^co-authored-by:\s*(.*)$/i.exec(line)?.[1]?.trim()
    if (!value) return false
    const email = (/<([^<>]+)>$/.exec(value)?.[1] ?? value).trim().toLowerCase()
    return AI_COAUTHOR_EMAILS.has(email) || AI_GITHUB_EMAIL.test(email)
  })
}

export const noAICoauthors: SyncRule = (parsed) => [
  !hasAICoauthor(parsed.raw ?? ''),
  'AI-assisted contributions are welcome. Remove AI-assistant Co-authored-by trailers and keep disclosure in the PR’s AI assistance section. Preserve human co-author credits.'
]
