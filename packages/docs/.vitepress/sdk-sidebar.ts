import type { DefaultTheme } from 'vitepress'

const SDK_COMPONENT_PAGES = [
  { text: 'CanvasRoot', slug: 'canvas-root' },
  { text: 'CanvasSurface', slug: 'canvas-surface' },
  { text: 'LayerTreeRoot', slug: 'layer-tree-root' },
  { text: 'LayerTreeItem', slug: 'layer-tree-item' },
  { text: 'ToolbarRoot', slug: 'toolbar-root' },
  { text: 'ToolbarItem', slug: 'toolbar-item' },
  { text: 'PageListRoot', slug: 'page-list-root' },
  { text: 'PropertySection', slug: 'property-section', canonical: true },
  { text: 'PropertyGrid', slug: 'property-grid', canonical: true },
  { text: 'SegmentedControl', slug: 'segmented-control', canonical: true },
  { text: 'PropertyListRoot', slug: 'property-list-root' },
  { text: 'PropertyListItem', slug: 'property-list-item' },
  { text: 'ColorPickerRoot', slug: 'color-picker-root', canonical: true },
  { text: 'ColorInputRoot', slug: 'color-input-root' },
  { text: 'ChannelSlider', slug: 'channel-slider', canonical: true },
  { text: 'FillRoot', slug: 'fill-root', canonical: true },
  { text: 'FillSwatch', slug: 'fill-swatch', canonical: true },
  { text: 'FontPickerRoot', slug: 'font-picker-root' },
  { text: 'GradientEditorRoot', slug: 'gradient-editor-root' },
  { text: 'GradientEditorBar', slug: 'gradient-editor-bar' },
  { text: 'GradientEditorStop', slug: 'gradient-editor-stop', canonical: true },
  { text: 'NumberField', slug: 'number-field', canonical: true },
  { text: 'BindableValue', slug: 'bindable-value', canonical: true },
  { text: 'LayoutControlsRoot', slug: 'layout-controls-root' },
  { text: 'ConstraintsControlRoot', slug: 'constraints-control-root', canonical: true },
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
  { text: 'useConstraints', slug: 'use-constraints', canonical: true },
  { text: 'useComponentProperties', slug: 'use-component-properties', canonical: true },
  { text: 'useAppearance', slug: 'use-appearance' },
  { text: 'useSharedStyleBinding', slug: 'use-shared-style-binding', canonical: true },
  { text: 'useColorModel', slug: 'use-color-model', canonical: true },
  { text: 'useTypography', slug: 'use-typography' },
  { text: 'useExport', slug: 'use-export' },
  { text: 'useFillControls', slug: 'use-fill-controls' },
  { text: 'useStrokeControls', slug: 'use-stroke-controls' },
  { text: 'useEffectsControls', slug: 'use-effects-controls' },
  { text: 'useMask', slug: 'use-mask', canonical: true },
  { text: 'useDocumentWorkspace', slug: 'use-document-workspace', canonical: true },
  { text: 'useVariablesEditor', slug: 'use-variables-editor' },
  { text: 'usePageList', slug: 'use-page-list' },
  { text: 'useI18n', slug: 'use-i18n' },
] as const

const SDK_ADVANCED_PAGES = [
  { text: 'useNodeProps', slug: 'use-node-props' },
  { text: 'useSceneComputed', slug: 'use-scene-computed' },
  { text: 'useColorVariableBinding', slug: 'use-color-variable-binding' },
  { text: 'useColorBindingProvider', slug: 'use-color-binding-provider', canonical: true },
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
  { text: 'useNumberField', slug: 'use-number-field', canonical: true },
  { text: 'useOkHCL', slug: 'use-okhcl' },
  { text: 'useVariables', slug: 'use-variables' },
  { text: 'useVariablesDialogState', slug: 'use-variables-dialog-state' },
  { text: 'useVariablesTable', slug: 'use-variables-table' },
  { text: 'Locale APIs', slug: 'locale-apis' },
  { text: 'useViewportKind', slug: 'use-viewport-kind' },
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
                link: `${'canonical' in page ? '' : prefix}/programmable/sdk/api/components/${page.slug}`
              }))
            ]
          },
          {
            text: 'Composables',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/composables/` },
              ...SDK_COMPOSABLE_PAGES.map((page) => ({
                text: page.text,
                link: `${'canonical' in page ? '' : prefix}/programmable/sdk/api/composables/${page.slug}`
              }))
            ]
          },
          {
            text: 'Advanced',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/advanced/` },
              ...SDK_ADVANCED_PAGES.map((page) => ({
                text: page.text,
                link: `${'canonical' in page ? '' : prefix}/programmable/sdk/api/advanced/${page.slug}`
              }))
            ]
          }
        ]
      }
    ]
  }
]
