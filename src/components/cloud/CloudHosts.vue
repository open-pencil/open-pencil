<script setup lang="ts">
import CloudConnectHost from './connect/CloudConnectHost.vue'
import CloudDraftSaveHost from './draft/CloudDraftSaveHost.vue'
import CloudInvitationHost from './invitation/CloudInvitationHost.vue'
import CloudReportHost from './report/CloudReportHost.vue'
import CloudShareHost from './share/CloudShareHost.vue'
import CloudNewWorkspaceHost from './workspace/CloudNewWorkspaceHost.vue'
import CloudWorkspaceMembersHost from './workspace/CloudWorkspaceMembersHost.vue'

/**
 * Cloud's app-wide dialogs: connecting a server, keeping a file without an account, invitations,
 * sharing the open document, reporting a shared one, and managing workspaces.
 */
</script>

<template>
  <CloudConnectHost />
  <CloudDraftSaveHost />
  <CloudInvitationHost />
  <CloudShareHost />
  <CloudReportHost />
  <CloudNewWorkspaceHost />
  <CloudWorkspaceMembersHost />
</template>
