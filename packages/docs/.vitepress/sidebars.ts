import type { ProgrammableLabels, SidebarLabels } from './labels'
import type { DefaultTheme } from 'vitepress'

export const guideSidebar = (prefix: string, labels: SidebarLabels): DefaultTheme.SidebarItem[] => [
  {
    text: labels.guide,
    items: [
      { text: labels.gettingStarted, link: `${prefix}/guide/getting-started` },
      { text: labels.features, link: `${prefix}/guide/features` },
      { text: labels.architecture, link: `${prefix}/guide/architecture` },
      { text: labels.techStack, link: `${prefix}/guide/tech-stack` },
      { text: labels.comparison, link: `${prefix}/guide/comparison` },
      { text: labels.figmaMatrix, link: `${prefix}/guide/figma-comparison` },
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
      { text: labels.cli, link: `${prefix}/programmable/cli` },
      { text: labels.inspecting, link: `${prefix}/programmable/inspecting` },
      { text: labels.exporting, link: `${prefix}/programmable/exporting` },
      { text: labels.analyzing, link: `${prefix}/programmable/analyzing` },
      { text: labels.scripting, link: `${prefix}/programmable/scripting` },
      { text: labels.jsxRenderer, link: `${prefix}/programmable/jsx-renderer` },
      { text: labels.mcpServer, link: `${prefix}/programmable/mcp-server` },
      { text: labels.aiChat, link: `${prefix}/programmable/ai-chat` },
      { text: labels.collaboration, link: `${prefix}/programmable/collaboration` },
    ],
  },
]

export const referenceSidebar = (prefix: string, label: string): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Keyboard Shortcuts', link: `${prefix}/reference/keyboard-shortcuts` },
      { text: 'CLI', link: `${prefix}/reference/cli` },
      { text: 'Node Types', link: `${prefix}/reference/node-types` },
      { text: 'Scene Graph', link: `${prefix}/reference/scene-graph` },
      { text: 'File Format', link: `${prefix}/reference/file-format` },
    ],
  },
]

export const developmentSidebar = (prefix: string, label: string): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Contributing', link: `${prefix}/development/contributing` },
      { text: 'Testing', link: `${prefix}/development/testing` },
      { text: 'Renderer Profiler', link: `${prefix}/development/renderer-profiler` },
      { text: 'Variables UI Roadmap', link: `${prefix}/development/variables-ui-roadmap` },
      { text: 'OpenSpec', link: `${prefix}/development/openspec` },
      { text: 'Roadmap', link: `${prefix}/development/roadmap` },
    ],
  },
]
