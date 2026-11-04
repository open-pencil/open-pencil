/**
 * Every Cloud component the rest of the app shows. A build with `VITE_OPENPENCIL_CLOUD=off`
 * resolves this module to `./off`, where each renders nothing, so Cloud's components stay out of
 * that build; components outside Cloud's folders import Cloud only from here.
 */
export { default as CloudSharedSection } from '@/components/home/cloud/CloudSharedSection.vue'
export { default as CloudWorkspaceSection } from '@/components/home/cloud/CloudWorkspaceSection.vue'
export { default as CloudSettingsSection } from '@/components/settings/cloud/CloudSettingsSection.vue'
export { default as CloudHosts } from '../CloudHosts.vue'
export { default as CloudShareButton } from '../share/CloudShareButton.vue'
export { default as CloudDocumentStatusHost } from '../status/CloudDocumentStatusHost.vue'
export { default as CloudVersionDialog } from '../versions/CloudVersionDialog.vue'
export { default as CloudVersionHistory } from '../versions/CloudVersionHistory.vue'
