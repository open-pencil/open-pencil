<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { communityPublisher, useCommunityDocuments } from '@/app/cloud-portal/community'
import { usePortal } from '@/app/cloud-portal/context'
import CommunityCard from '@/components/cloud-portal/community/CommunityCard.vue'
import CommunityLayout from '@/components/cloud-portal/community/CommunityLayout.vue'
import PortalLoadAlert from '@/components/cloud-portal/layout/PortalLoadAlert.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { AppTabsContent, AppTabsList, AppTabsRoot, AppTabsTrigger } from '@/components/ui/tabs'

/**
 * The server's community gallery: every file in it, newest change first, narrowed by type and by
 * a search of their names.
 */
const portal = usePortal()
const messages = useCloudPortalMessages()
const ui = portalCommunity()
const { state, reload } = useCommunityDocuments(portal.discovery)
const publisher = communityPublisher(portal.discovery, portal.host)

type Filter = 'all' | 'design' | 'board'
const filter = ref<Filter>('all')
const query = ref('')

const documents = computed(() => (state.value.status === 'ready' ? state.value.documents : []))
const counts = computed(() => ({
  all: documents.value.length,
  design: documents.value.filter((entry) => entry.kind === 'design').length,
  board: documents.value.filter((entry) => entry.kind === 'board').length
}))
const shown = computed(() => {
  const words = query.value.trim().toLocaleLowerCase()
  return documents.value.filter(
    (entry) =>
      (filter.value === 'all' || entry.kind === filter.value) &&
      (!words || entry.name.toLocaleLowerCase().includes(words))
  )
})
const filters = computed(() => [
  { value: 'all' as const, label: messages.value.communityFilterAll },
  { value: 'design' as const, label: messages.value.communityKindDesigns },
  { value: 'board' as const, label: messages.value.communityKindBoards }
])

useHead(() => ({ title: `${messages.value.communityTitle} · ${portal.host}` }))
</script>

<template>
  <CommunityLayout>
    <div :class="ui.hero()">
      <h1 :class="ui.title()">{{ messages.communityTitle }}</h1>
      <p :class="ui.description()">{{ messages.communityDescription }}</p>
    </div>
    <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />
    <template v-else-if="state.status === 'loading'">
      <span role="status" class="sr-only">{{ messages.loading }}</span>
      <div :class="ui.grid()" aria-hidden="true">
        <div v-for="index in 6" :key="index" class="flex flex-col gap-3">
          <AppSkeleton class="aspect-[16/10] w-full rounded-xl" />
          <AppSkeleton class="h-3 w-40" />
          <AppSkeleton class="h-3 w-28" />
        </div>
      </div>
    </template>
    <AppPlaceholder
      v-else-if="documents.length === 0"
      :label="messages.communityEmpty"
      :class="ui.empty()"
    />
    <AppTabsRoot v-else v-model="filter">
      <div :class="ui.toolbar()">
        <AppTabsList :label="messages.communityTitle">
          <AppTabsTrigger v-for="entry in filters" :key="entry.value" :value="entry.value">
            {{ entry.label }}
            <template #trailing>
              <span :class="ui.count()">{{ counts[entry.value] }}</span>
            </template>
          </AppTabsTrigger>
        </AppTabsList>
        <AppInput
          v-model="query"
          type="search"
          size="sm"
          :placeholder="messages.communitySearch"
          :aria-label="messages.communitySearch"
          :class="ui.search()"
        >
          <template #leading><icon-lucide-search class="size-3.5" /></template>
        </AppInput>
      </div>
      <AppTabsContent v-for="entry in filters" :key="entry.value" :value="entry.value" class="pt-6">
        <p v-if="shown.length === 0" :class="[ui.description(), 'pt-6']">
          {{
            query.trim()
              ? messages.communityNoMatches({ query: query.trim() })
              : messages.communityEmpty
          }}
        </p>
        <ul v-else :class="ui.grid()">
          <li v-for="document in shown" :key="document.id">
            <CommunityCard :document="document" :publisher="publisher" />
          </li>
        </ul>
      </AppTabsContent>
    </AppTabsRoot>
  </CommunityLayout>
</template>
