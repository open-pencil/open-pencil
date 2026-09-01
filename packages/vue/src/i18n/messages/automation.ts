import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const automationMessageDefaults = {
  connections: 'MCP connections',
  connectionsDescription: 'Give ACP agents access to trusted remote tools and services.',
  addConnection: 'Add connection',
  addServerConnection: 'Add MCP connection',
  editConnection: 'Edit MCP connection',
  connectionEditorDescription: 'Configure a Streamable HTTP server and optional authentication.',
  connectionName: 'Connection name',
  serverURL: 'MCP server URL',
  enableConnection: 'Enable for ACP agents',
  bearerAuthentication: 'Use bearer authentication',
  bearerToken: 'Bearer token',
  bearerTokenPlaceholder: 'Enter bearer token',
  bearerTokenRequired: 'Enter a bearer token before enabling this connection.',
  deleteConnection: 'Delete connection',
  deleteConnectionDescription: 'Delete this MCP connection and remove its saved bearer token?',
  noConnections: 'No external MCP connections configured.',
  description: 'Monitor and restart the local MCP server used by agents and automation.',
  status: 'Status',
  port: 'Port',
  address: 'Address',
  version: 'Version',
  authentication: 'Require authentication',
  authenticationDescription:
    'Protect the localhost MCP endpoint with a bearer token. Disable only on a trusted machine. Restart the server to apply changes.',
  rootDirectory: 'MCP root directory',
  rootDirectoryDefault: 'User home directory (default)',
  chooseRootDirectory: 'Choose folder',
  useDefaultRoot: 'Use default',
  rootDirectoryDescription:
    'File tools are limited to this folder. Restart the MCP server to apply changes.',
  tools: 'Available tools',
  toolsEnabled: params('{enabled} of {total} enabled'),
  enableAllTools: 'Enable all',
  searchTools: 'Search MCP tools',
  readOnlyTools: 'Read-only tools',
  sideEffectTools: 'Tools with side effects',
  toolsRestartNotice:
    'Restart the MCP server, then reconnect stdio clients, to apply tool availability changes.',
  externalRestartNotice:
    'This server is managed by another process. Restart that process to apply changes.',
  restart: 'Restart MCP server',
  externallyManaged: 'Managed externally',
  starting: 'Starting…',
  statusIdle: 'Not initialized',
  statusStarting: 'Starting',
  statusRunning: 'Running',
  statusStopped: 'Stopped',
  statusError: 'Error'
} as const

export const automationMessages = i18n('automation', automationMessageDefaults)
