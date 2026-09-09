import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import IconImage from '~icons/lucide/image'
import IconSettings from '~icons/lucide/settings'

import AppTabsContent from './AppTabsContent.vue'
import AppTabsList from './AppTabsList.vue'
import AppTabsRoot from './AppTabsRoot.vue'
import AppTabsTrigger from './AppTabsTrigger.vue'

type Args = {
  orientation: 'horizontal' | 'vertical'
  activationMode: 'automatic' | 'manual'
  constrained: boolean
}
const meta = {
  title: 'Design System/Navigation/Tabs',
  args: { orientation: 'horizontal', activationMode: 'automatic', constrained: false },
  render: (args: Args) => ({
    components: {
      AppTabsRoot,
      AppTabsList,
      AppTabsTrigger,
      AppTabsContent,
      IconSettings,
      IconImage
    },
    setup: () => ({ selected: ref('general'), args }),
    template: `
      <AppTabsRoot v-model="selected" :orientation="args.orientation" :activation-mode="args.activationMode" class="h-64 max-w-xl bg-panel text-surface">
        <AppTabsList label="Settings">
          <AppTabsTrigger value="general">
            <template #leading><IconSettings class="size-3.5" /></template>
            {{ args.constrained ? '非常に長い一般設定のラベル' : 'General' }}
          </AppTabsTrigger>
          <AppTabsTrigger value="media">
            <template #leading><IconImage class="size-3.5" /></template>
            Media
            <template #trailing><span class="rounded bg-accent px-1 text-white">3</span></template>
          </AppTabsTrigger>
          <AppTabsTrigger value="unavailable" disabled>Unavailable</AppTabsTrigger>
        </AppTabsList>
        <AppTabsContent value="general" class="p-4">General preferences</AppTabsContent>
        <AppTabsContent value="media" class="p-4">Media preferences</AppTabsContent>
      </AppTabsRoot>
    `
  })
} satisfies Meta<Args>

export default meta
export const Default: StoryObj<typeof meta> = { name: 'Horizontal' }
export const Vertical: StoryObj<typeof meta> = { args: { orientation: 'vertical' } }
export const ConstrainedLabels: StoryObj<typeof meta> = {
  args: { orientation: 'vertical', constrained: true }
}
export const ManualActivation: StoryObj<typeof meta> = { args: { activationMode: 'manual' } }
