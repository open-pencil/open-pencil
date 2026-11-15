import type { DefaultTheme } from 'vitepress'

import type { NavLabels, ProgrammableLabels, SidebarLabels } from './labels.ts'

export const guideSidebar = (prefix: string, labels: SidebarLabels): DefaultTheme.SidebarItem[] => [
  {
    text: labels.overview,
    items: [
      { text: labels.gettingStarted, link: `${prefix}/getting-started` },
      { text: labels.features, link: `${prefix}/overview/features` },
      { text: labels.comparison, link: `${prefix}/overview/comparison` },
      // English only until translated; locales link to the canonical page.
      { text: labels.privacy, link: '/overview/privacy' }
    ]
  }
]

export const userGuideSidebar = (
  prefix: string,
  labels: SidebarLabels
): DefaultTheme.SidebarItem[] => [
  {
    text: labels.gettingAround,
    items: [
      { text: labels.canvasNav, link: `${prefix}/user-guide/canvas-navigation` },
      { text: labels.selection, link: `${prefix}/user-guide/selection-and-manipulation` },
      { text: labels.contextMenu, link: `${prefix}/user-guide/context-menu` }
    ]
  },
  {
    text: labels.creatingContent,
    items: [
      { text: labels.shapes, link: `${prefix}/user-guide/drawing-shapes` },
      { text: labels.text, link: `${prefix}/user-guide/text-editing` },
      { text: labels.pen, link: `${prefix}/user-guide/pen-tool` },
      { text: labels.vectorEditing, link: `${prefix}/user-guide/vector-edit` },
      // English only until translated; locales link to the canonical page.
      { text: labels.icons, link: '/user-guide/icons' },
      { text: labels.photos, link: '/user-guide/photos' }
    ]
  },
  {
    text: labels.organizing,
    items: [
      { text: labels.layers, link: `${prefix}/user-guide/layers-and-pages` },
      { text: labels.exporting, link: `${prefix}/user-guide/exporting` },
      // English only until translated; locales link to the canonical page.
      { text: labels.cloudStorage, link: '/user-guide/cloud-storage' }
    ]
  },
  {
    text: labels.advanced,
    items: [
      { text: labels.autoLayout, link: `${prefix}/user-guide/auto-layout` },
      { text: labels.components, link: `${prefix}/user-guide/components` },
      { text: labels.variables, link: `${prefix}/user-guide/variables` },
      // English only until translated; locales link to the canonical page.
      { text: labels.checkingDesigns, link: '/user-guide/checking-designs' }
    ]
  }
]

/** The Developers section's own pages, by the tool they cover. */
export const programmableSidebar = (
  prefix: string,
  labels: ProgrammableLabels
): DefaultTheme.SidebarItem[] => [
  { text: labels.overview, link: `${prefix}/developers/` },
  {
    text: labels.cli,
    items: [
      { text: labels.commandReference, link: '/reference/cli' },
      { text: labels.inspecting, link: `${prefix}/developers/cli/inspecting` },
      { text: labels.exporting, link: `${prefix}/developers/cli/exporting` },
      { text: labels.analyzing, link: `${prefix}/developers/cli/analyzing` },
      { text: labels.comparing, link: '/developers/cli/comparing' },
      { text: labels.appControl, link: '/developers/cli/app-control' },
      { text: labels.scripting, link: `${prefix}/developers/cli/scripting` }
    ]
  },
  {
    text: labels.aiAgents,
    items: [
      { text: labels.mcpServer, link: '/developers/mcp-server' },
      { text: labels.jsxRenderer, link: `${prefix}/developers/jsx-renderer` },
      { text: 'Design Authoring Reference', link: '/reference/design-authoring' }
    ]
  },
  {
    text: labels.libraries,
    items: [
      { text: 'Vue SDK', link: `${prefix}/developers/sdk/` },
      { text: 'Native JavaScript APIs', link: '/developers/native-api' }
    ]
  }
]

/** Reference pages for people using the editor; the rest of the reference is for developers. */
export const USER_REFERENCE_PAGES = [
  '/reference/keyboard-shortcuts',
  '/reference/figma-compatibility'
]

const userReferenceNames = USER_REFERENCE_PAGES.map((page) =>
  page.slice('/reference/'.length)
).join('|')

/** The header item a page belongs to, as `activeMatch` patterns for a locale's `prefix`. */
export const sectionMatch = (prefix: string) => ({
  docs: `^${prefix}/(getting-started|overview/|user-guide/|reference/(${userReferenceNames}))`,
  developers: `^${prefix}/(developers/|development/|reference/(?!${userReferenceNames}))`
})

/** The Docs section: the overview, the user guide, and the reference for using the editor. */
export const docsSidebar = (
  prefix: string,
  referenceLabel: string,
  labels: SidebarLabels,
  prog: ProgrammableLabels
): DefaultTheme.SidebarItem[] => [
  ...guideSidebar(prefix, labels),
  ...userGuideSidebar(prefix, labels),
  {
    text: labels.aiAndCollaboration,
    items: [
      { text: prog.aiChat, link: `${prefix}/user-guide/ai-chat` },
      // English only until translated; locales link to the canonical page.
      { text: 'Coding Agents', link: '/user-guide/coding-agents' },
      { text: 'Models and Providers', link: '/user-guide/models-and-providers' },
      { text: prog.collaboration, link: `${prefix}/user-guide/collaboration` }
    ]
  },
  {
    text: referenceLabel,
    items: [
      // English only until translated; locales link to the canonical page.
      { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
      { text: labels.figmaMatrix, link: `${prefix}/reference/figma-compatibility` }
    ]
  }
]

/** The Developers section: automation, the reference for code, and contributing. */
export const developersSidebar = (
  prefix: string,
  nav: Pick<NavLabels, 'reference' | 'development'>,
  labels: SidebarLabels,
  prog: ProgrammableLabels
): DefaultTheme.SidebarItem[] => [
  ...programmableSidebar(prefix, prog),
  {
    text: nav.reference,
    items: [
      { text: 'Node Types', link: '/reference/node-types' },
      { text: 'Scene Graph', link: '/reference/scene-graph' },
      ...(!prefix ? [{ text: 'DOM/CSS Mapping', link: '/reference/dom-css-mapping' }] : []),
      { text: 'File Format', link: '/reference/file-format' },
      { text: prog.urlScheme, link: `${prefix}/developers/url-scheme` }
    ]
  },
  ...developmentSidebar('', nav.development, labels, prog.internals)
]

export const developmentSidebar = (
  prefix: string,
  label: string,
  labels: SidebarLabels,
  internalsLabel: string
): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Contributing', link: `${prefix}/development/contributing` },
      { text: 'Testing', link: `${prefix}/development/testing` },
      { text: labels.architecture, link: `${prefix}/development/architecture` },
      { text: '.fig Reader Architecture', link: '/development/fig-reader' },
      { text: labels.techStack, link: `${prefix}/development/tech-stack` },
      { text: 'Testing a Model Provider', link: '/development/testing-model-providers' },
      { text: 'Roadmap', link: '/development/roadmap' }
    ]
  },
  {
    // How parts of the editor work inside, for whoever changes them; English only.
    text: internalsLabel,
    collapsed: true,
    items: [
      { text: 'AI Chat Replies', link: '/development/ai-chat' },
      { text: 'Behaviours and Preview', link: '/development/behaviours-and-preview' },
      { text: 'Cloud Architecture', link: '/development/cloud' },
      { text: 'Demo Tour', link: '/development/demo-tour' },
      { text: 'Document Identity', link: '/development/document-identity' },
      { text: 'Navigation Performance', link: '/development/navigation-performance' },
      { text: 'Renderer Lifecycle', link: '/development/renderer-lifecycle' },
      { text: 'Renderer Profiler', link: '/development/renderer-profiler' },
      { text: 'Vector Conversion', link: '/development/vector-conversion' }
    ]
  }
]

/** OpenPencil Cloud, in English only: using it, running a server, and the hosted service's legal documents. */
export const cloudSidebar = (): DefaultTheme.SidebarItem[] => [
  {
    text: 'Using Cloud',
    items: [
      { text: 'Overview', link: '/cloud/' },
      { text: 'Your Account', link: '/cloud/account' },
      { text: 'Documents', link: '/cloud/documents' },
      { text: 'Sharing and Teams', link: '/cloud/sharing' },
      { text: 'AI on Cloud', link: '/cloud/ai' },
      { text: 'Support', link: '/cloud/support' }
    ]
  },
  {
    text: 'Self-hosting',
    items: [
      { text: 'Install and Configure', link: '/cloud/self-hosting/' },
      { text: 'Cloudflare Workers', link: '/cloud/self-hosting/cloudflare' },
      { text: 'Storage and Email', link: '/cloud/self-hosting/storage-and-email' },
      { text: 'AI Services', link: '/cloud/self-hosting/ai-services' },
      { text: 'Operations', link: '/cloud/self-hosting/operations' }
    ]
  },
  {
    // The hosted service's own documents: a Cloud server someone else runs has its own.
    text: 'Hosted Service Legal',
    items: [
      { text: 'Terms of Service', link: '/cloud/legal/terms' },
      { text: 'Privacy Policy', link: '/cloud/legal/privacy' },
      { text: 'Subprocessors', link: '/cloud/legal/subprocessors' }
    ]
  }
]
