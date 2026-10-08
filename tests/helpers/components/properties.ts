import type { Page } from '@playwright/test'

export interface PropertyAuthoringScene {
  buttonId: string
  labelId: string
  cardId: string
  cardInstanceId: string
}

/** A Button component with a Label text, nested in a Card component, and an instance of Card. */
export function createPropertyAuthoringScene(page: Page): Promise<PropertyAuthoringScene> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const button = store.graph.createNode('COMPONENT', pageId, { name: 'Button', width: 120 })
    const label = store.graph.createNode('TEXT', button.id, { name: 'Label', text: 'Button' })
    const card = store.graph.createNode('COMPONENT', pageId, { name: 'Card', y: 120, width: 200 })
    const action = store.graph.createInstance(button.id, card.id, { name: 'Action' })
    const cardInstance = store.graph.createInstance(card.id, pageId, { x: 300, y: 120 })
    if (!action || !cardInstance) throw new Error('Expected instances')
    return {
      buttonId: button.id,
      labelId: label.id,
      cardId: card.id,
      cardInstanceId: cardInstance.id
    }
  })
}

export async function selectNode(page: Page, nodeId: string): Promise<void> {
  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([id])
  }, nodeId)
}

/** A component's property definitions, as name, type, and default. */
export function componentPropertyDefinitions(page: Page, componentId: string) {
  return page.evaluate((id) => {
    const node = window.openPencil?.getStore?.()?.graph.getNode(id)
    return (node?.componentPropertyDefinitions ?? []).map(({ name, type, defaultValue }) => ({
      name,
      type,
      defaultValue
    }))
  }, componentId)
}

/** The text a nested instance shows inside an instance. */
export function nestedInstanceText(page: Page, instanceId: string, nestedName: string) {
  return page.evaluate(
    ({ id, name }) => {
      const graph = window.openPencil?.getStore?.()?.graph
      const nested = graph?.getChildren(id).find((node) => node.name === name)
      if (!graph || !nested) return null
      return graph.getChildren(nested.id).find((node) => node.type === 'TEXT')?.text ?? null
    },
    { id: instanceId, name: nestedName }
  )
}
