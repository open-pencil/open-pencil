export type CloudBrowserStorageSettings = {
  serverURL: string
  workspaceId: string
}

export function configureCloudBrowserStorage(settings: CloudBrowserStorageSettings): void {
  localStorage.setItem(
    'open-pencil:cloud:connections',
    JSON.stringify([
      {
        id: 'cloud-browser-e2e',
        kind: 'self-hosted',
        label: 'Cloud browser E2E',
        serverURL: settings.serverURL,
        selectedWorkspaceId: settings.workspaceId
      }
    ])
  )
  localStorage.setItem('open-pencil:cloud:active-connection', 'cloud-browser-e2e')
  localStorage.setItem('open-pencil:storage:provider', 'openpencil-cloud')
  localStorage.setItem(
    'open-pencil:storage:preferences',
    JSON.stringify({
      'openpencil-cloud': {
        'server-url': settings.serverURL,
        'workspace-id': settings.workspaceId
      }
    })
  )
}

export function readCloudBrowserStorage(): {
  provider: string | null
  preferences: string | null
} {
  return {
    provider: localStorage.getItem('open-pencil:storage:provider'),
    preferences: localStorage.getItem('open-pencil:storage:preferences')
  }
}
