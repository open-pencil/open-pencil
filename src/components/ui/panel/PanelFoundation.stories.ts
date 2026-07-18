import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { TooltipProvider } from 'reka-ui'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'
import MoreIcon from '~icons/lucide/ellipsis'
import EyeIcon from '~icons/lucide/eye'
import LinkIcon from '~icons/lucide/link'
import RotateIcon from '~icons/lucide/rotate-ccw'
import SquareIcon from '~icons/lucide/square'

import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

import PanelFieldGroup from './PanelFieldGroup.vue'
import PanelGrid from './PanelGrid.vue'
import PanelHeader from './PanelHeader.vue'
import PanelRail from './PanelRail.vue'
import PanelSection from './PanelSection.vue'

const meta = {
  title: 'Design System/Properties/Panel Foundation',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The 26px properties-panel foundation: strict grids, field groups, action rails, and semantic field states.'
      }
    }
  }
} satisfies Meta<typeof PanelSection>

export default meta
type Story = StoryObj<typeof meta>

export const StateMatrix: Story = {
  render: () => ({
    components: {
      AppInput,
      AppSelect,
      EyeIcon,
      IconButton,
      LinkIcon,
      MoreIcon,
      PanelFieldGroup,
      PanelGrid,
      PanelHeader,
      PanelRail,
      PanelSection,
      RotateIcon,
      SegmentedControl,
      SquareIcon,
      TooltipProvider
    },
    setup() {
      const width = ref<string | number>(320)
      const height = ref<string | number>(240)
      const mixed = ref<string | number>('Mixed')
      const bound = ref<string | number>('spacing/md')
      const disabled = ref<string | number>(16)
      const blendMode = ref('NORMAL')
      const alignment = ref('left')

      return {
        width,
        height,
        mixed,
        bound,
        disabled,
        blendMode,
        alignment,
        blendModes: [
          { value: 'NORMAL', label: 'Normal' },
          { value: 'MULTIPLY', label: 'Multiply' },
          { value: 'SCREEN', label: 'Screen' }
        ],
        alignmentOptions: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' }
        ]
      }
    },
    template: `
      <TooltipProvider>
        <div class="w-[320px] overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
          <PanelHeader>
            <template #icon><SquareIcon class="size-3.5" /></template>
            <span role="heading" aria-level="2">Rectangle</span>
            <template #actions>
              <IconButton label="Selection actions"><MoreIcon class="size-3.5" /></IconButton>
            </template>
          </PanelHeader>

          <PanelSection label="Layout">
            <template #actions>
              <IconButton label="Reset layout"><RotateIcon class="size-3.5" /></IconButton>
            </template>
            <PanelGrid columns="two-rail">
              <PanelFieldGroup label="Width">
                <AppInput v-model="width" tone="panel" data-story-control data-state="idle" aria-label="Width" />
              </PanelFieldGroup>
              <PanelFieldGroup label="Height">
                <AppInput v-model="height" tone="panel" data-story-control data-state="focus" aria-label="Height" />
              </PanelFieldGroup>
              <PanelRail>
                <IconButton label="Constrain proportions" size="md"><LinkIcon class="size-3.5" /></IconButton>
              </PanelRail>
            </PanelGrid>
          </PanelSection>

          <PanelSection label="Appearance">
            <PanelGrid columns="two-rail">
              <PanelFieldGroup label="Blend mode">
                <AppSelect v-model="blendMode" :options="blendModes" data-story-control aria-label="Blend mode" />
              </PanelFieldGroup>
              <PanelFieldGroup label="Opacity">
                <AppInput v-model="mixed" tone="panel" state="mixed" readonly data-story-control aria-label="Mixed opacity" />
              </PanelFieldGroup>
              <PanelRail>
                <IconButton label="Toggle visibility"><EyeIcon class="size-3.5" /></IconButton>
              </PanelRail>
            </PanelGrid>
          </PanelSection>

          <PanelSection label="States">
            <div class="grid grid-cols-2 gap-1.5">
              <PanelFieldGroup label="Bound">
                <AppInput v-model="bound" tone="panel" state="bound" readonly data-story-control aria-label="Bound value" />
              </PanelFieldGroup>
              <PanelFieldGroup label="Disabled">
                <AppInput v-model="disabled" tone="panel" disabled data-story-control aria-label="Disabled value" />
              </PanelFieldGroup>
              <PanelFieldGroup label="Alignment" class="col-span-2">
                <SegmentedControl v-model="alignment" class="w-full" :options="alignmentOptions" label="Alignment" data-story-control />
              </PanelFieldGroup>
            </div>
          </PanelSection>
        </div>
      </TooltipProvider>
    `
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const controls = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-story-control]'))

    for (const control of controls) await expect(control).toHaveStyle({ height: '26px' })

    await userEvent.click(canvas.getByLabelText('Height'))
    await userEvent.hover(canvas.getByLabelText('Width'))
  }
}
