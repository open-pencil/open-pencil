<script setup lang="ts">
import { computed } from 'vue'

import { documentKindRules } from '@open-pencil/core/editor'

import { useEditorStore } from '@/app/editor/active-store'
import CollabAvatarStack from '@/components/CollabPanel/CollabAvatarStack.vue'
import CollabSharePopover from '@/components/CollabPanel/CollabSharePopover.vue'
import { provideCollabPanel } from '@/components/CollabPanel/context'
import PresentButton from '@/components/presentation/PresentButton.vue'

provideCollabPanel()

const store = useEditorStore()
/**
 * Slides mode offers no collaboration at all — avatars included, not just Share. None of it
 * has been exercised against decks, so the whole surface is withheld rather than shipped
 * untested. Present is not collaboration and stays.
 */
const collaborative = computed(() => documentKindRules(store.state.documentKind).collaborative)
</script>

<template>
  <div class="flex w-full items-center justify-end gap-2">
    <CollabAvatarStack v-if="collaborative" />
    <div class="flex-1" />
    <PresentButton />
    <CollabSharePopover v-if="collaborative" />
  </div>
</template>
