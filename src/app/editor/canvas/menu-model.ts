const COMPONENT_MENU_LABEL_PARTS = ['component', 'instance']

export function isComponentMenuItem(label: string) {
  const normalized = label.toLowerCase()
  return COMPONENT_MENU_LABEL_PARTS.some((part) => normalized.includes(part))
}

export function canvasMenuItemClass(label: string, classes: { item: string; component: string }) {
  return isComponentMenuItem(label) ? classes.component : classes.item
}

export function canvasMenuShortcutClass(label: string) {
  return isComponentMenuItem(label) ? 'text-component/60' : 'text-muted'
}
