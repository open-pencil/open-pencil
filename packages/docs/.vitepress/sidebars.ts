import type { ProgrammableLabels, SidebarLabels } from './labels.ts'
import type { DefaultTheme } from 'vitepress'

export const guideSidebar = (prefix: string, labels: SidebarLabels): DefaultTheme.SidebarItem[] => [
  {
    text: labels.overview,
    items: [
      { text: labels.gettingStarted, link: `${prefix}/getting-started` },
      { text: labels.features, link: `${prefix}/overview/features` },
      { text: labels.comparison, link: `${prefix}/overview/comparison` },
    ],
  },
]

export const userGuideSidebar = (
  prefix: string,
  labels: SidebarLabels,
): DefaultTheme.SidebarItem[] => [
  {
    text: labels.gettingAround,
    items: [
      { text: labels.canvasNav, link: `${prefix}/user-guide/canvas-navigation` },
      { text: labels.selection, link: `${prefix}/user-guide/selection-and-manipulation` },
      { text: labels.contextMenu, link: `${prefix}/user-guide/context-menu` },
    ],
  },
  {
    text: labels.creatingContent,
    items: [
      { text: labels.shapes, link: `${prefix}/user-guide/drawing-shapes` },
      { text: labels.text, link: `${prefix}/user-guide/text-editing` },
      { text: labels.pen, link: `${prefix}/user-guide/pen-tool` },
      { text: labels.vectorEditing, link: `${prefix}/user-guide/vector-edit` },
    ],
  },
  {
    text: labels.organizing,
    items: [
      { text: labels.layers, link: `${prefix}/user-guide/layers-and-pages` },
      { text: labels.exporting, link: `${prefix}/user-guide/exporting` },
    ],
  },
  {
    text: labels.advanced,
    items: [
      { text: labels.autoLayout, link: `${prefix}/user-guide/auto-layout` },
      { text: labels.components, link: `${prefix}/user-guide/components` },
      { text: labels.variables, link: `${prefix}/user-guide/variables` },
    ],
  },
]

export const programmableSidebar = (
  prefix: string,
  labels: ProgrammableLabels,
): DefaultTheme.SidebarItem[] => [
  {
    text: labels.overview,
    items: [
      { text: labels.overview, link: `${prefix}/programmable/` },
      { text: labels.cli, link: '/reference/cli' },
      { text: labels.inspecting, link: `${prefix}/programmable/cli/inspecting` },
      { text: labels.exporting, link: `${prefix}/programmable/cli/exporting` },
      { text: labels.analyzing, link: `${prefix}/programmable/cli/analyzing` },
      { text: labels.scripting, link: `${prefix}/programmable/cli/scripting` },
      { text: labels.jsxRenderer, link: `${prefix}/programmable/jsx-renderer` },
      { text: labels.mcpServer, link: '/programmable/mcp-server' },
      { text: labels.aiChat, link: `${prefix}/programmable/ai-chat` },
      ...(!prefix
        ? [
            {
              text: 'BYOK Compatibility',
              link: '/programmable/byok-provider-compatibility',
            },
          ]
        : []),
      { text: labels.collaboration, link: `${prefix}/programmable/collaboration` },
    ],
  },
]

export const referenceSidebar = (
  prefix: string,
  label: string,
  labels: SidebarLabels,
): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
      { text: 'CLI', link: '/reference/cli' },
      { text: 'Node Types', link: '/reference/node-types' },
      { text: 'Scene Graph', link: '/reference/scene-graph' },
      { text: labels.figmaMatrix, link: `${prefix}/reference/figma-compatibility` },
      ...(!prefix ? [{ text: 'DOM/CSS Mapping', link: '/reference/dom-css-mapping' }] : []),
      { text: 'File Format', link: '/reference/file-format' },
    ],
  },
]

export const developmentSidebar = (
  prefix: string,
  label: string,
  labels: SidebarLabels,
): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Contributing', link: `${prefix}/development/contributing` },
      { text: 'Testing', link: `${prefix}/development/testing` },
      { text: labels.architecture, link: `${prefix}/development/architecture` },
      { text: labels.techStack, link: `${prefix}/development/tech-stack` },
      ...(!prefix
        ? [
            { text: 'Roadmap', link: '/development/roadmap' },
            { text: 'Renderer Profiler', link: '/development/renderer-profiler' },
            { text: 'Vector Conversion', link: '/development/vector-conversion' },
          ]
        : []),
    ],
  },
]
