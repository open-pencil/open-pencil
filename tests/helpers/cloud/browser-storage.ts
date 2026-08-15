export type CloudBrowserStorageSettings = {
  serverURL: string
  workspaceId: string
}

export function configureCloudBrowserStorage(settings: CloudBrowserStorageSettings): void {
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
