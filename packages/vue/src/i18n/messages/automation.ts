import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const automationMessageDefaults = {
  mcpConnections: 'MCP connections',
  mcpConnectionsDescription: 'Give ACP agents access to trusted remote tools and services.',
  addConnection: 'Add connection',
  addMCPConnection: 'Add MCP connection',
  editMCPConnection: 'Edit MCP connection',
  mcpConnectionEditorDescription: 'Configure a Streamable HTTP server and optional authentication.',
  connectionName: 'Connection name',
  mcpServerURL: 'MCP server URL',
  enableMCPConnection: 'Enable for ACP agents',
  mcpBearerAuthentication: 'Use bearer authentication',
  mcpBearerToken: 'Bearer token',
  mcpBearerTokenPlaceholder: 'Enter bearer token',
  mcpBearerTokenRequired: 'Enter a bearer token before enabling this connection.',
  deleteMCPConnection: 'Delete connection',
  deleteMCPConnectionDescription: 'Delete this MCP connection and remove its saved bearer token?',
  noMCPConnections: 'No external MCP connections configured.',
  mcpDescription: 'Monitor and restart the local MCP server used by agents and automation.',
  mcpStatus: 'Status',
  mcpPort: 'Port',
  mcpAddress: 'Address',
  mcpVersion: 'Version',
  mcpAuthentication: 'Require authentication',
  mcpAuthenticationDescription:
    'Protect the localhost MCP endpoint with a bearer token. Disable only on a trusted machine. Restart the server to apply changes.',
  mcpRootDirectory: 'MCP root directory',
  mcpRootDirectoryDefault: 'User home directory (default)',
  mcpChooseRootDirectory: 'Choose folder',
  mcpUseDefaultRoot: 'Use default',
  mcpRootDirectoryDescription:
    'File tools are limited to this folder. Restart the MCP server to apply changes.',
  mcpTools: 'Available tools',
  mcpToolsEnabled: params('{enabled} of {total} enabled'),
  mcpEnableAllTools: 'Enable all',
  mcpSearchTools: 'Search MCP tools',
  mcpReadOnlyTools: 'Read-only tools',
  mcpSideEffectTools: 'Tools with side effects',
  mcpToolsRestartNotice:
    'Restart the MCP server, then reconnect stdio clients, to apply tool availability changes.',
  mcpExternalRestartNotice:
    'This server is managed by another process. Restart that process to apply changes.',
  mcpRestart: 'Restart MCP server',
  mcpExternallyManaged: 'Managed externally',
  mcpStarting: 'Starting…',
  mcpStatus_idle: 'Not initialized',
  mcpStatus_starting: 'Starting',
  mcpStatus_running: 'Running',
  mcpStatus_stopped: 'Stopped',
  mcpStatus_error: 'Error'
} as const

export const automationMessages = i18n('automation', automationMessageDefaults)
