import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  addSwitchBehaviour,
  createSwitch,
  island,
  startPreview
} from '#tests/helpers/components/behaviours'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetupWithClear('/?test&no-rulers')

/** The transition a layer of the island plays, as its inline style declares it. */
function layerTransition(islandId: string, path: string) {
  return island(editor.page, islandId)
    .locator(`[data-layer="${path}"]`)
    .evaluate((element: HTMLElement) => ({
      duration: element.style.transitionDuration,
      easing: element.style.transitionTimingFunction
    }))
}

test('a transition added in the Behaviour section eases the switch’s states in preview', async () => {
  const ids = await createSwitch(editor.page)
  await editor.canvas.waitForRender()
  await addSwitchBehaviour(editor.page)
  const section = propertySection(editor.page, 'Behaviour')
  await section.getByRole('button', { name: 'Animate state changes' }).click()
  const duration = section.getByRole('spinbutton', { name: 'Duration' })
  await expect(section.getByTestId('behaviour-transition-duration')).toContainText('300')
  await duration.dblclick()
  await duration.fill('250')
  await duration.press('Enter')
  await expect(section.getByTestId('behaviour-transition-duration')).toContainText('250')

  await startPreview(editor.page)
  await expect
    .poll(() => layerTransition(ids.instanceId, 'Knob'))
    .toEqual({
      duration: '250ms',
      easing: 'ease-out'
    })
})

test('a transition follows its variables in the mode the instance is in', async () => {
  const ids = await createSwitch(editor.page)
  await editor.canvas.waitForRender()
  await editor.page.evaluate((setId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const motion = store.graph.createCollection('Motion')
    const reduced = store.graph.createMode(motion.id, 'Reduced') ?? ''
    const fast = store.graph.createVariable('Duration/Fast', 'TIMING', motion.id, 0.15)
    fast.valuesByMode[reduced] = 0
    store.setBehaviour(setId, {
      kind: 'switch',
      booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } },
      texts: {},
      numbers: {},
      parts: {},
      transition: { duration: 0.15, easing: { easing: 'LINEAR' }, durationVariableId: fast.id }
    })
    return { collection: motion.id, reduced }
  }, ids.setId)

  await startPreview(editor.page)
  await expect
    .poll(() => layerTransition(ids.instanceId, 'Knob'))
    .toEqual({
      duration: '150ms',
      easing: 'linear'
    })

  await editor.page.evaluate((instanceId) => {
    const store = window.openPencil?.getStore?.()
    const motion = [...(store?.graph.variableCollections.values() ?? [])].find(
      (collection) => collection.name === 'Motion'
    )
    const reduced = motion?.modes.find((mode) => mode.name === 'Reduced')
    if (!store || !motion || !reduced) throw new Error('No Motion collection')
    store.graph.updateNode(instanceId, { variableModes: { [motion.id]: reduced.modeId } })
    store.state.sceneVersion++
  }, ids.instanceId)
  await expect
    .poll(() => layerTransition(ids.instanceId, 'Knob'))
    .toMatchObject({
      duration: '0ms'
    })

  // With motion turned off, preview changes state at once.
  await editor.page.evaluate(() => (document.documentElement.dataset.motion = 'off'))
  await expect
    .poll(() => layerTransition(ids.instanceId, 'Knob'))
    .toEqual({
      duration: '',
      easing: ''
    })
  await editor.page.evaluate(() => delete document.documentElement.dataset.motion)
})
