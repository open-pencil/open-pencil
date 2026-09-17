import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const automationMessageDefaults = {
  toolAccessDescription:
    'Configure design tools independently for built-in AI and the local MCP server.',
  toolAccessTarget: 'Configure tool access for',
  builtInAI: 'Built-in AI',
  localMCP: 'Local MCP',
  restoreToolDefaults: 'Restore defaults',
  aiToolAccessDescription:
    'Choose tools for direct AI model connections. ACP and Pi agents use MCP access instead.',
  mcpToolAccessDescription:
    'Choose tools advertised by the local server to connected agents and clients.',
  aiToolsNotice:
    'Changes apply to your next message. Tool switches are not a sandbox: enabled script tools can still perform other design operations.',
  mcpFailureNotInstalled: 'MCP automation is not installed',
  mcpFailureNotInstalledHint: params(
    'Install {package} globally with your package manager, then restart OpenPencil.'
  ),
  mcpFailurePermission: 'OpenPencil cannot start the MCP server',
  mcpFailurePermissionHint:
    'The system denied the command. Reinstall OpenPencil with its shell permissions, or start the server manually.',
  mcpFailureExited: 'MCP server stopped during startup',
  mcpFailureExitedHint: 'The process exited before it became ready.',
  mcpFailureTimeout: 'MCP server did not respond in time',
  mcpFailureTimeoutHint: 'It did not become ready within the startup timeout.',
  mcpFailureRejected: 'MCP server rejected the local connection',
  mcpFailureRejectedHint: 'Restart the MCP server to issue a new token.',
  mcpFailureMalformed: 'MCP server returned an unexpected response',
  mcpFailureMalformedHint:
    'The configured version and the running server may not match. Update both and restart OpenPencil.',
  mcpFailureUnreachable: 'MCP server is not reachable',
  mcpFailureUnreachableHint: params(
    'Nothing is listening at {endpoint}. Check that the address is free, then start the server.'
  ),
  mcpFailureUnknown: 'MCP server could not start',
  mcpFailureUnknownHint: 'Start it again, or check the diagnostic details below.',
  mcpFailureDetails: 'Details',
  mcpFailureCopy: 'Copy details',
  mcpFailureCopied: 'Diagnostic details copied.',
  localServer: 'Local server',
  webmcpDescription:
    'Let browser agents use this document directly, without a local MCP server or bearer token. Local server settings do not apply here.',
  browserAccess: 'Browser agent access',
  accessOff: 'Off',
  accessInspect: 'Inspect',
  accessEdit: 'Edit',
  accessOffDescription: 'No tools are exposed to browser agents.',
  accessInspectDescription: 'Agents can inspect the document but cannot change it.',
  accessEditDescription:
    'Agents can also edit existing properties, text, and variable values. Edits are undoable; creating or deleting content, scripts, and file access are excluded.',
  webmcpUnsupported:
    'This browser does not expose WebMCP. Use a supported Chrome version and enable WebMCP testing, then relaunch the browser.',
  webmcpSetup: 'WebMCP setup guide',
  noMatchingTools: 'No tools match your search.',
  connections: 'MCP connections',
  connectionsDescription: 'Give ACP agents access to trusted remote tools and services.',
  addConnection: 'Add connection',
  addServerConnection: 'Add MCP connection',
  editConnection: 'Edit MCP connection',
  connectionEditorDescription: 'Configure a Streamable HTTP server and optional authentication.',
  connectionName: 'Connection name',
  connectionNameHint: 'Use a unique name, up to 80 characters. The name open-pencil is reserved.',
  connectionNameInvalid: 'Choose a unique name of at most 80 characters, other than open-pencil.',
  serverURLHint:
    'Use HTTPS. HTTP is allowed only for localhost or a loopback address. Do not include credentials in the URL.',
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
  rootDirectoryDefault: 'Server default directory',
  chooseRootDirectory: 'Choose folder',
  useDefaultRoot: 'Use default',
  rootDirectoryDescription:
    'File tools are limited to this folder. Restart the MCP server to apply changes.',
  tools: 'Available tools',
  toolsEnabled: params('{enabled} of {total} enabled'),
  enableAllTools: 'Enable all',
  searchTools: 'Search tools',
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
