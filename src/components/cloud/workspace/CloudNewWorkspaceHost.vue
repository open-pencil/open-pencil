<script setup lang="ts">
import {
  createWorkspace,
  newWorkspaceBusy,
  newWorkspaceFailure,
  newWorkspaceName,
  newWorkspaceOpen
} from '@/app/cloud/workspaces/manage'

import CloudNewWorkspaceDialog from './CloudNewWorkspaceDialog.vue'

/** The one New workspace dialog, driven by the app's workspace actions. */
</script>

<template>
  <CloudNewWorkspaceDialog
    v-model:open="newWorkspaceOpen"
    v-model:name="newWorkspaceName"
    :busy="newWorkspaceBusy"
    :failed="newWorkspaceFailure !== null"
    @create="createWorkspace"
  />
</template>
