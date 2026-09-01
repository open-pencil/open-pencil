export { noBrowserSideEffectsInVue, noDocumentQuerySelectorInVue } from './browser.ts'
export { noLargePropertySectionComponents } from './size.ts'
export {
  noDynamicDataTestIdInVue,
  noGeneratedTestIdLiterals,
  noInvalidTestIdAttributes,
  noRawTestIdSelectorsInTests,
  noRawTestIdStringProps,
  noTestIdHelperBindInVue
} from './test-ids.ts'
export {
  noHardcodedTipLabelsInVue,
  noNativeTitleAttributesInVue,
  noRawSvgInAppVueTemplates,
  noUiHelperCallsInVueTemplates,
  noVueStyleBlocks
} from './template.ts'
