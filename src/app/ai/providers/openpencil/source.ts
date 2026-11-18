import type { Ref } from 'vue'

import type { CloudServicesClient } from '@open-pencil/cloud/client'

import {
  cloudAIClient,
  cloudAIIdentity,
  cloudAIWorkspaces,
  type CloudAIWorkspace
} from '@/app/cloud/integration'

/** The Home server's AI service: who is signed in, the workspaces with AI, and their catalog. */
export interface CloudAISource {
  identity: Readonly<Ref<string | null>>
  workspaces: () => Promise<CloudAIWorkspace[]>
  client: (workspaceId: string) => Pick<CloudServicesClient, 'catalog'> | null
}

export const HOME_CLOUD_AI: CloudAISource = {
  identity: cloudAIIdentity,
  workspaces: cloudAIWorkspaces,
  client: cloudAIClient
}
