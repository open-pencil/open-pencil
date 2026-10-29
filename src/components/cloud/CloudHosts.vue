<script setup lang="ts">
import CloudConnectHost from './connect/CloudConnectHost.vue'
import CloudInvitationHost from './invitation/CloudInvitationHost.vue'
import CloudShareHost from './share/CloudShareHost.vue'
import CloudNewWorkspaceHost from './workspace/CloudNewWorkspaceHost.vue'
import CloudWorkspaceMembersHost from './workspace/CloudWorkspaceMembersHost.vue'

/**
 * Cloud's app-wide dialogs: connecting a server, invitations, sharing the open document, and
 * managing workspaces.
 */
</script>

<template>
  <CloudConnectHost />
  <CloudInvitationHost />
  <CloudShareHost />
  <CloudNewWorkspaceHost />
  <CloudWorkspaceMembersHost />
</template>
