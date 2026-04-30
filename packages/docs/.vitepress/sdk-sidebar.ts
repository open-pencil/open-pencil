import type { DefaultTheme } from 'vitepress'

const SDK_COMPONENT_PAGES = [
  { text: 'CanvasRoot', slug: 'canvas-root' },
  { text: 'CanvasSurface', slug: 'canvas-surface' },
  { text: 'LayerTreeRoot', slug: 'layer-tree-root' },
  { text: 'LayerTreeItem', slug: 'layer-tree-item' },
  { text: 'ToolbarRoot', slug: 'toolbar-root' },
  { text: 'ToolbarItem', slug: 'toolbar-item' },
  { text: 'PageListRoot', slug: 'page-list-root' },
  { text: 'PropertyListRoot', slug: 'property-list-root' },
  { text: 'PropertyListItem', slug: 'property-list-item' },
  { text: 'ColorPickerRoot', slug: 'color-picker-root' },
  { text: 'ColorInputRoot', slug: 'color-input-root' },
  { text: 'FillPickerRoot', slug: 'fill-picker-root' },
  { text: 'FontPickerRoot', slug: 'font-picker-root' },
  { text: 'GradientEditorRoot', slug: 'gradient-editor-root' },
  { text: 'GradientEditorBar', slug: 'gradient-editor-bar' },
  { text: 'GradientEditorStop', slug: 'gradient-editor-stop' },
  { text: 'ScrubInputRoot', slug: 'scrub-input-root' },
  { text: 'ScrubInputField', slug: 'scrub-input-field' },
  { text: 'ScrubInputDisplay', slug: 'scrub-input-display' },
  { text: 'LayoutControlsRoot', slug: 'layout-controls-root' },
  { text: 'AppearanceControlsRoot', slug: 'appearance-controls-root' },
  { text: 'PositionControlsRoot', slug: 'position-controls-root' },
  { text: 'TypographyControlsRoot', slug: 'typography-controls-root' }
] as const

const SDK_COMPOSABLE_PAGES = [
  { text: 'provideEditor', slug: 'provide-editor' },
  { text: 'useEditor', slug: 'use-editor' },
  { text: 'useCanvas', slug: 'use-canvas' },
  { text: 'useCanvasInput', slug: 'use-canvas-input' },
  { text: 'useTextEdit', slug: 'use-text-edit' },
  { text: 'useSelectionState', slug: 'use-selection-state' },
  { text: 'useSelectionCapabilities', slug: 'use-selection-capabilities' },
  { text: 'useEditorCommands', slug: 'use-editor-commands' },
  { text: 'useMenuModel', slug: 'use-menu-model' },
  { text: 'usePosition', slug: 'use-position' },
  { text: 'useLayout', slug: 'use-layout' },
  { text: 'useAppearance', slug: 'use-appearance' },
  { text: 'useTypography', slug: 'use-typography' },
  { text: 'useExport', slug: 'use-export' },
  { text: 'useFillControls', slug: 'use-fill-controls' },
  { text: 'useStrokeControls', slug: 'use-stroke-controls' },
  { text: 'useEffectsControls', slug: 'use-effects-controls' },
  { text: 'useVariablesEditor', slug: 'use-variables-editor' },
  { text: 'usePageList', slug: 'use-page-list' }
] as const

const SDK_ADVANCED_PAGES = [
  { text: 'useNodeProps', slug: 'use-node-props' },
  { text: 'useSceneComputed', slug: 'use-scene-computed' },
  { text: 'useFillVariableBinding', slug: 'use-fill-variable-binding' },
  { text: 'useFillPicker', slug: 'use-fill-picker' },
  { text: 'useGradientStops', slug: 'use-gradient-stops' },
  { text: 'useFontPicker', slug: 'use-font-picker' },
  { text: 'usePropScrub', slug: 'use-prop-scrub' },
  { text: 'useLayerDrag', slug: 'use-layer-drag' },
  { text: 'useInlineRename', slug: 'use-inline-rename' },
  { text: 'useToolbarState', slug: 'use-toolbar-state' },
  { text: 'useNodeFontStatus', slug: 'use-node-font-status' },
  { text: 'useCanvasDrop', slug: 'use-canvas-drop' },
  { text: 'extractImageFilesFromClipboard', slug: 'extract-image-files-from-clipboard' },
  { text: 'toolCursor', slug: 'tool-cursor' },
  { text: 'useCanvasContext', slug: 'use-canvas-context' },
  { text: 'useLayerTree', slug: 'use-layer-tree' },
  { text: 'useToolbar', slug: 'use-toolbar' },
  { text: 'usePropertyList', slug: 'use-property-list' },
  { text: 'useScrubInput', slug: 'use-scrub-input' }
] as const

export const sdkSidebar = (prefix: string): DefaultTheme.SidebarItem[] => [
  {
    text: 'Vue SDK',
    items: [
      { text: 'Overview', link: `${prefix}/programmable/sdk/` },
      { text: 'Getting Started', link: `${prefix}/programmable/sdk/getting-started` },
      { text: 'Architecture', link: `${prefix}/programmable/sdk/architecture` },
      { text: 'Custom Shell', link: `${prefix}/programmable/sdk/guides/custom-editor-shell` },
      { text: 'Property Panels', link: `${prefix}/programmable/sdk/guides/property-panels` },
      { text: 'Navigation Panels', link: `${prefix}/programmable/sdk/guides/navigation-panels` },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: `${prefix}/programmable/sdk/api/` },
          {
            text: 'Components',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/components/` },
              ...SDK_COMPONENT_PAGES.map((page) => ({
                text: page.text,
                link: `${prefix}/programmable/sdk/api/components/${page.slug}`
              }))
            ]
          },
          {
            text: 'Composables',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/composables/` },
              ...SDK_COMPOSABLE_PAGES.map((page) => ({
                text: page.text,
                link: `${prefix}/programmable/sdk/api/composables/${page.slug}`
              }))
            ]
          },
          {
            text: 'Advanced',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/advanced/` },
              ...SDK_ADVANCED_PAGES.map((page) => ({
                text: page.text,
                link: `${prefix}/programmable/sdk/api/advanced/${page.slug}`
              }))
            ]
          }
        ]
      }
    ]
  }
]
