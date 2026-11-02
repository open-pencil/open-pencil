<script setup lang="ts">
import {
  createWorkspace,
  newWorkspaceBusy,
  newWorkspaceFailure,
  newWorkspaceOpen
} from '@/app/cloud/workspaces/manage'

import CloudNewWorkspaceDialog from './CloudNewWorkspaceDialog.vue'

/** The one New workspace dialog, driven by the app's workspace actions. */
</script>

<template>
  <CloudNewWorkspaceDialog
    v-model:open="newWorkspaceOpen"
    :busy="newWorkspaceBusy"
    :failed="newWorkspaceFailure !== null"
    @create="createWorkspace"
    @cancel="newWorkspaceOpen = false"
  />
</template>
