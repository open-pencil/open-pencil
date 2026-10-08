import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconCircle from '~icons/lucide/circle'
import IconFrame from '~icons/lucide/frame'
import IconSquare from '~icons/lucide/square'
import IconType from '~icons/lucide/type'

import type { LintFix } from '@open-pencil/core/lint'

import type { IssueAction } from '@/app/editor/design-check/format'
import type { DesignIssue } from '@/app/editor/design-check/issues'

import IssueGroup from './IssueGroup.vue'
import type { IssueGroupView, IssueRowView } from './types'

function issue(ruleId: string, nodeId: string, severity: DesignIssue['severity']): DesignIssue {
  return {
    id: `${ruleId}:${nodeId}:0`,
    ruleId,
    nodeId,
    severity,
    message: ruleId,
    nodeName: nodeId,
    nodePath: [nodeId],
    pageId: 'page'
  }
}

function row(overrides: Partial<IssueRowView> & Pick<IssueRowView, 'issue' | 'layerName'>) {
  return {
    layerIcon: IconSquare,
    detail: null,
    swatch: null,
    action: null,
    hidden: false,
    missing: false,
    selected: false,
    pageLabel: null,
    ...overrides
  } satisfies IssueRowView
}

const contrast: IssueGroupView = {
  ruleId: 'color-contrast',
  severity: 'error',
  title: 'Low text contrast',
  help: 'Text needs a contrast ratio of at least 4.5:1 with its background to meet WCAG AA.',
  fixes: [],
  bindsOnly: true,
  rows: [
    row({
      issue: issue('color-contrast', 'caption', 'error'),
      layerName: 'Caption',
      layerIcon: IconType,
      detail: '2.8:1',
      swatch: { kind: 'contrast', foreground: '#FFFFFF', background: '#F97316' },
      selected: true
    })
  ]
}

const brandFix = {
  kind: 'bind-variable',
  path: 'fills/0/color',
  variableId: 'brand',
  variableName: 'Colors/Blue/600'
} satisfies LintFix

function bindAction(nodeId: string): IssueAction {
  return { request: { nodeId, fix: brandFix }, label: 'Bind to Blue/600', kind: 'bind-variable' }
}

const colors: IssueGroupView = {
  ruleId: 'no-hardcoded-colors',
  severity: 'warning',
  title: 'Unbound color',
  help: 'This color matches a color variable. Bind it so theme and palette changes reach this layer.',
  fixes: [bindAction('card').request, bindAction('dot').request],
  bindsOnly: true,
  rows: [
    row({
      issue: issue('no-hardcoded-colors', 'card', 'warning'),
      layerName: 'Pricing card with a long descriptive name',
      layerIcon: IconFrame,
      detail: 'Blue/600',
      swatch: { kind: 'color', color: '#2563EB' },
      action: bindAction('card')
    }),
    row({
      issue: issue('no-hardcoded-colors', 'dot', 'warning'),
      layerName: 'Status dot',
      layerIcon: IconCircle,
      detail: 'Blue/600',
      swatch: { kind: 'color', color: '#2563EB' },
      action: bindAction('dot'),
      hidden: true
    }),
    row({
      issue: issue('no-hardcoded-colors', 'removed', 'warning'),
      layerName: 'Removed',
      detail: 'Gray/800',
      swatch: { kind: 'color', color: '#1F2937' },
      missing: true
    })
  ]
}

const radius: IssueGroupView = {
  ruleId: 'consistent-radius',
  severity: 'info',
  title: 'Off-scale corner radius',
  help: 'Corner radius should come from the radius scale or a variable.',
  fixes: [],
  bindsOnly: true,
  rows: [
    row({
      issue: issue('consistent-radius', 'card', 'info'),
      layerName: 'Card',
      layerIcon: IconFrame,
      detail: '10 px',
      action: {
        request: { nodeId: 'card', fix: { kind: 'set', changes: { cornerRadius: 12 } } },
        label: 'Change to 12 px',
        kind: 'set'
      }
    })
  ]
}

interface IssueGroupStoryArgs {
  group: IssueGroupView
  open?: boolean
}

const meta = {
  title: 'App/Editor/Design Check/Issue Group',
  component: IssueGroup,
  args: { group: contrast },
  render: (args) => ({
    components: { IssueGroup },
    setup: () => ({ args }),
    template: `
      <div class="w-60 bg-panel py-1">
        <IssueGroup v-bind="args" />
      </div>
    `
  })
} satisfies Meta<IssueGroupStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const ContrastError: Story = {}

export const FixableColors: Story = { args: { group: colors } }

export const Collapsed: Story = { args: { group: colors, open: false } }

export const Suggestion: Story = { args: { group: radius } }
