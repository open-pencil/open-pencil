import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const diagnosticsMessageDefaults = {
  usageDescription: 'Local usage summaries from recorded AI requests.',
  usageRequests: 'Requests',
  usageCompleted: 'Completed',
  usageInputTokens: 'Input tokens',
  usageOutputTokens: 'Output tokens',
  usageByModel: 'By model',
  usageNoData: 'No usage data recorded.',
  usageNotReported: 'Not reported',
  usageCacheNote: 'Cache values are shown only when the provider reports them.',
  title: 'Diagnostics',
  modelStepCompleted: 'AI model step completed',
  chatCompleted: 'AI chat completed',
  chatFailed: 'AI chat failed',
  storageFailed: 'Storage operation failed',
  documentFailed: 'Document operation failed',
  acpFailed: 'ACP transport failed',
  mcpFailed: 'MCP connection failed',
  technicalEvent: 'Technical event',
  retention: 'Diagnostics retention',
  retentionDescription: 'Keep up to this many recent events locally.',
  description:
    'Store technical events locally to help troubleshoot OpenPencil. Prompts, design content, credentials, and API keys are excluded.',
  localDiagnostics: 'Local diagnostics',
  localDiagnosticsDescription: 'Keep recent technical events on this device.',
  usageHistory: 'Usage history',
  usageHistoryDescription: 'Keep local AI usage summaries.',
  eventCount: params('{count} events · {size} KB'),
  copy: 'Copy diagnostics',
  clear: 'Clear',
  clearDescription: 'This removes locally stored diagnostic events from this device.',
  cleared: 'Diagnostics cleared.',
  copied: 'Diagnostics copied to clipboard.',
  copyFailed: 'Could not copy diagnostics to the clipboard.'
} as const

export const diagnosticsMessages = i18n('diagnostics', diagnosticsMessageDefaults)
