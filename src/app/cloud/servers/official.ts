import { computed } from 'vue'

import { cloudServers } from './store'

/** Whether this install has an account on OpenPencil Cloud, the official server. */
export const officialCloudSignedIn = computed(() =>
  cloudServers.value.some((server) => server.kind === 'official' && server.account !== null)
)
