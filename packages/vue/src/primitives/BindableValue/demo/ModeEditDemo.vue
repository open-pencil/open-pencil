<script setup lang="ts">
import { ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { prepareModeEdit } from '#vue/controls/binding-provider/mode-edit'
import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import BindableValueRoot from '#vue/primitives/BindableValue/BindableValueRoot.vue'

const editor = createEditor()
const page = editor.graph.getPages()[0]
if (!page) throw new Error('Missing demo page')
const collection = editor.graph.createCollection('Spacing')
editor.graph.addMode(collection.id, 'large', 'Large')
editor.graph.addMode(collection.id, 'untouched', 'Untouched')
const variable = editor.graph.createVariable('Space', 'FLOAT', collection.id, 8)
editor.updateVariableValue(variable.id, 'large', 8)
editor.updateVariableValue(variable.id, 'untouched', 40)
const first = editor.graph.createNode('FRAME', page.id, {})
const second = editor.graph.createNode('FRAME', page.id, {
  variableModes: { [collection.id]: 'large' }
})
const other = editor.graph.createNode('FRAME', page.id, {
  variableModes: { [collection.id]: 'untouched' }
})
for (const node of [first, second, other]) editor.bindVariable(node.id, 'width', variable.id)
const revision = ref(0)
const targets = ref([first, first, second].map((node) => ({ nodeId: node.id, path: 'width' })))
const provider = createOpenPencilBindingProvider(
  editor,
  {
    type: 'FLOAT',
    resolve: (e, id, target) =>
      target
        ? e.graph.resolveNumberVariableForNode(target.nodeId, id)
        : e.resolveNumberVariable(id),
    prepareEdit: (e, id, target) =>
      prepareModeEdit(e, id, target, () => e.graph.resolveNumberVariableForNode(target.nodeId, id))
  },
  revision
)
function changeTargets() {
  editor.graph.updateNode(second.id, { variableModes: {} })
  targets.value = [{ nodeId: other.id, path: 'width' }]
  revision.value++
}
function values() {
  void revision.value
  return JSON.stringify(editor.getVariable(variable.id)?.valuesByMode ?? null)
}
function undo() {
  editor.undo.undo()
  revision.value++
}
function removeVariable() {
  editor.graph.variables.delete(variable.id)
  revision.value++
}
function refresh(action: () => unknown) {
  action()
  revision.value++
}
</script>

<template>
  <BindableValueRoot
    v-slot="{ actions, state, bindingId }"
    :provider="provider"
    :targets="targets"
    :value="8"
    policy="edit-variable"
  >
    <div class="flex flex-wrap gap-2 bg-panel p-4 text-surface">
      <button @click="actions.beginMutation('edit')">Begin edit</button>
      <button @click="refresh(() => actions.applyValue(12))">Set 12</button>
      <button @click="changeTargets">Change selection and mode</button>
      <button @click="refresh(() => actions.applyValue(20))">Set 20</button>
      <button @click="refresh(actions.cancelMutation)">Cancel</button>
      <button @click="actions.commitMutation()">Commit</button>
      <button @click="undo">Undo</button>
      <button @click="removeVariable">Remove variable definition</button>
      <button @click="refresh(actions.unbind)">Detach</button>
      <output aria-label="Binding state">{{ state }}</output>
      <output aria-label="Binding identity">{{ bindingId }}</output>
      <output aria-label="Mode values">{{ values() }}</output>
    </div>
  </BindableValueRoot>
</template>
