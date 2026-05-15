export function toolbarFlyoutTestId(tool: string, mobile = false) {
  return `${mobile ? 'mobile-' : ''}toolbar-flyout-${tool.toLowerCase()}`
}

export function toolbarFlyoutItemTestId(tool: string, mobile = false) {
  return `${mobile ? 'mobile-' : ''}toolbar-flyout-item-${tool.toLowerCase()}`
}

export function variablesAddTestId(type: string) {
  return `variables-add-${type.toLowerCase()}`
}
