import { defineComponent } from 'vue'

/** A Cloud component in a build without Cloud (`VITE_OPENPENCIL_CLOUD=off`): it renders nothing. */
function absent(name: string) {
  return defineComponent({ name, inheritAttrs: false, render: () => null })
}

export const CloudSharedSection = absent('CloudSharedSection')
export const CloudWorkspaceSection = absent('CloudWorkspaceSection')
export const CloudSettingsSection = absent('CloudSettingsSection')
export const CloudHosts = absent('CloudHosts')
export const CloudShareButton = absent('CloudShareButton')
export const CloudDocumentStatusHost = absent('CloudDocumentStatusHost')
export const CloudVersionDialog = absent('CloudVersionDialog')
export const CloudVersionHistory = absent('CloudVersionHistory')
