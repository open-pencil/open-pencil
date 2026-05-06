import { useInlineRename } from '#vue/editor/inline-rename/use'
import { useVariables } from '#vue/variables/use'

export function useVariablesDialogState() {
  const variables = useVariables()

  const collectionRename = useInlineRename((id, newName) => {
    variables.renameCollection(id, newName)
  })

  const modeRename = useInlineRename((modeId, newName) => {
    variables.renameMode(modeId, newName)
  })

  function startRenameCollection(id: string) {
    const col = variables.collections.value.find((c) => c.id === id)
    if (col) collectionRename.start(id, col.name)
  }

  function startRenameMode(modeId: string) {
    const mode = variables.activeModes.value.find((m) => m.modeId === modeId)
    if (mode) modeRename.start(modeId, mode.name)
  }

  return {
    ...variables,
    collectionRename,
    modeRename,
    startRenameCollection,
    startRenameMode
  }
}
