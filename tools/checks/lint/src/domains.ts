import { noHandRolledColor, noHardcodedColorConstants } from '#lint/rules/data/color.ts'
import { noHandRolledDataURLRule } from '#lint/rules/data/data-url.ts'
import {
  noDirectGraphEmitterSubscriptions,
  noDirectOpenPencilBrowserStore,
  noDirectOpenPencilWindowInternals,
  noDirectSelectionToolStateMutation,
  noDocumentChangeCapture,
  noEditorProfileInputs,
  noInlinePromptConstants,
  noStructuredCloneSceneArrays,
  noZoomInSceneDrawing
} from '#lint/rules/editor.ts'
import {
  noAppImportsInPackages,
  noCoreFrameworkImports,
  noCoreSelfPackageImports,
  noCrossPackageSourceImports,
  noInlineTauriImports,
  noVueSelfPackageImports
} from '#lint/rules/imports.ts'
import {
  noBunGlobalsInCli,
  noCoreBrowserGlobals,
  noDirectStorageAccess,
  noRawConsoleFormat,
  noTypeofWindowCheck,
  noViteHotOutsideReload
} from '#lint/rules/runtime.ts'
import {
  componentNamespaceCasing,
  noComponentRootSiblingFolder,
  noFlatKiwiModules,
  noTopLevelPrefixedTestFiles,
  nonComponentSourceDirectoriesKebabCase,
  vueComponentFilePascalCase
} from '#lint/rules/structure.ts'
import {
  noInterpolatedTailwindClassesRule,
  noPhysicalSideTailwindClassesRule,
  noPxTailwindValuesRule,
  noUnknownTailwindClassesRule
} from '#lint/rules/tailwind.ts'
import {
  noDynamicDataTestIdInVue,
  noGeneratedTestIdLiterals,
  noInvalidTestIdAttributes,
  noRawTestIdSelectorsInTests,
  noRawTestIdStringProps,
  noTestIdHelperBindInVue
} from '#lint/rules/test-ids.ts'
import { noInlineNamedTypes, noLocalJsonObjectAliases } from '#lint/rules/types.ts'
import { noBrowserSideEffectsInVue, noDocumentQuerySelectorInVue } from '#lint/rules/vue/browser.ts'
import {
  maxCompositionRootLines,
  noComposableStateWrappers,
  noOnUnmountedInCompositionRoots,
  preferVueUseIntervals,
  preferVueUseTimeouts
} from '#lint/rules/vue/composition.ts'
import { noOverlayContentFromOpenState, noRawOverlayRootsInApp } from '#lint/rules/vue/overlays.ts'
import { noLargePropertySectionComponents } from '#lint/rules/vue/size.ts'
import {
  noHardcodedTipLabelsInVue,
  noNativeTitleAttributesInVue,
  noRawSvgInAppVueTemplates,
  noUiHelperCallsInVueTemplates,
  noVueStyleBlocks
} from '#lint/rules/vue/template.ts'
import type { PluginRule } from '#lint/support/types.ts'

/**
 * The rules only this repository needs, by domain. `lint/<domain>.js` loads each domain as the
 * `@open-pencil/<domain>` plugin, with `@open-pencil/oxlint-plugin`'s rules of the same domain.
 */
export const domains = {
  data: {
    'no-hand-rolled-color': noHandRolledColor,
    'no-hand-rolled-data-url': noHandRolledDataURLRule,
    'no-hardcoded-color-constants': noHardcodedColorConstants
  },
  types: {
    'no-inline-named-types': noInlineNamedTypes,
    'no-local-json-object-aliases': noLocalJsonObjectAliases
  },
  runtime: {
    'no-bun-globals-in-cli': noBunGlobalsInCli,
    'no-core-browser-globals': noCoreBrowserGlobals,
    'no-direct-storage-access': noDirectStorageAccess,
    'no-raw-console-format': noRawConsoleFormat,
    'no-typeof-window-check': noTypeofWindowCheck,
    'no-vite-hot-outside-reload': noViteHotOutsideReload
  },
  security: {},
  imports: {
    'no-app-in-packages': noAppImportsInPackages,
    'no-core-framework': noCoreFrameworkImports,
    'no-core-self-package': noCoreSelfPackageImports,
    'no-cross-package-source': noCrossPackageSourceImports,
    'no-inline-tauri': noInlineTauriImports,
    'no-vue-self-package': noVueSelfPackageImports
  },
  structure: {
    'component-namespace-casing': componentNamespaceCasing,
    'no-component-root-sibling-folder': noComponentRootSiblingFolder,
    'no-flat-kiwi-modules': noFlatKiwiModules,
    'no-top-level-prefixed-test-files': noTopLevelPrefixedTestFiles,
    'non-component-directories-kebab-case': nonComponentSourceDirectoriesKebabCase,
    'vue-component-file-pascal-case': vueComponentFilePascalCase
  },
  vue: {
    'max-composition-root-lines': maxCompositionRootLines,
    'no-browser-side-effects': noBrowserSideEffectsInVue,
    'no-composable-state-wrappers': noComposableStateWrappers,
    'no-document-query-selector': noDocumentQuerySelectorInVue,
    'no-hardcoded-tip-labels': noHardcodedTipLabelsInVue,
    'no-large-property-section-components': noLargePropertySectionComponents,
    'no-native-title-attributes': noNativeTitleAttributesInVue,
    'no-on-unmounted-in-composition-roots': noOnUnmountedInCompositionRoots,
    'no-overlay-content-from-open-state': noOverlayContentFromOpenState,
    'no-raw-overlay-roots': noRawOverlayRootsInApp,
    'no-raw-svg-in-templates': noRawSvgInAppVueTemplates,
    'no-style-blocks': noVueStyleBlocks,
    'no-ui-helper-calls-in-templates': noUiHelperCallsInVueTemplates,
    'prefer-vueuse-intervals': preferVueUseIntervals,
    'prefer-vueuse-timeouts': preferVueUseTimeouts
  },
  'test-ids': {
    'no-dynamic-attributes': noDynamicDataTestIdInVue,
    'no-generated-literals': noGeneratedTestIdLiterals,
    'no-helper-bind': noTestIdHelperBindInVue,
    'no-invalid-attributes': noInvalidTestIdAttributes,
    'no-raw-selectors-in-tests': noRawTestIdSelectorsInTests,
    'no-raw-string-props': noRawTestIdStringProps
  },
  tailwind: {
    'no-interpolated-classes': noInterpolatedTailwindClassesRule,
    'no-physical-sides': noPhysicalSideTailwindClassesRule,
    'no-px-values': noPxTailwindValuesRule,
    'no-unknown-classes': noUnknownTailwindClassesRule
  },
  editor: {
    'no-direct-browser-store': noDirectOpenPencilBrowserStore,
    'no-direct-graph-emitter-subscriptions': noDirectGraphEmitterSubscriptions,
    'no-direct-selection-tool-state-mutation': noDirectSelectionToolStateMutation,
    'no-direct-window-internals': noDirectOpenPencilWindowInternals,
    'no-document-change-capture': noDocumentChangeCapture,
    'no-inline-prompt-constants': noInlinePromptConstants,
    'no-profile-inputs': noEditorProfileInputs,
    'no-structuredclone-scene-arrays': noStructuredCloneSceneArrays,
    'no-zoom-in-scene-drawing': noZoomInSceneDrawing
  }
} satisfies Record<string, Record<string, PluginRule>>
