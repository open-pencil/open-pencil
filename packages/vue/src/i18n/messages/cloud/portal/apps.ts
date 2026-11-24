import { params } from '@nanostores/i18n'

/** Messages of the Cloud server's pages for apps connected to an account through OAuth. */
export const appPortalMessageDefaults = {
  connectedApps: 'Connected apps',
  connectedAppsDescription: 'Apps you allowed to use your documents as you.',
  columnWorkspace: 'Workspace',
  columnAccess: 'Access',
  columnConnected: 'Connected',
  accessRead: 'Read only',
  accessWrite: 'Read and change',
  disconnect: 'Disconnect',
  disconnectHeading: params('Disconnect {name}?'),
  disconnectDescription:
    'It can’t reach your documents anymore. You can connect it again from the app.',
  noConnectedApps: 'No connected apps',
  authorizeTitle: params('Connect {app}?'),
  authorizeDescription: params('It asks to use your documents as {email}.'),
  authorizeAddress: params('It says it comes from {host}.'),
  authorizeRead: 'See and download documents in one workspace',
  authorizeWrite: 'See, create, change, and delete documents in one workspace',
  authorizeOffline: 'Stays connected until you disconnect it',
  authorizeOnline: 'Stays connected for an hour',
  authorizeWorkspace: 'Workspace',
  authorizeWorkspaceHint: 'The app reaches only this workspace’s documents.',
  authorizeWorkspacePlaceholder: 'Choose a workspace',
  authorizeWorkspaceGone: 'You’re no longer in that workspace. Choose another one.',
  authorizeNoWorkspaceTitle: 'You need a workspace first',
  authorizeNoWorkspaceDescription: 'Create a workspace in the editor, then connect the app again.',
  authorizeWarningTitle: 'Only connect apps you trust',
  authorizeWarningDescription:
    'An app chooses its own name. It works as you in the workspace until you disconnect it under Connected apps.',
  allow: 'Allow',
  pairDescription: 'It asks to design in OpenPencil in this browser, without an account.',
  pairAccess: 'See and change the designs open in OpenPencil in this browser',
  pairReturns: params('Goes back to {host}'),
  pairWarning:
    'An app chooses its own name. It can change any design you have open until you disconnect it in Settings → MCP.',
  authorizeExpiredTitle: 'This request has expired',
  authorizeExpiredDescription: 'Go back to the app and connect it again.'
}
