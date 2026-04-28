import type { Editor } from '@open-pencil/core/editor'

type TextEditor = NonNullable<Editor['textEditor']>

function handleHorizontalArrow(event: KeyboardEvent, editor: TextEditor) {
  const select = event.shiftKey
  const isMeta = event.metaKey || event.ctrlKey
  if (event.code === 'ArrowLeft') {
    if (isMeta) editor.moveToLineStart(select)
    else if (event.altKey) editor.moveWordLeft(select)
    else editor.moveLeft(select)
  } else if (event.code === 'ArrowRight') {
    if (isMeta) editor.moveToLineEnd(select)
    else if (event.altKey) editor.moveWordRight(select)
    else editor.moveRight(select)
  }
}

export function extendSelectionForDeletion(event: KeyboardEvent, editor: TextEditor) {
  const isMeta = event.metaKey || event.ctrlKey
  const forward = event.code === 'Delete'
  if (forward) {
    if (isMeta) editor.moveToLineEnd(true)
    else if (event.altKey) editor.moveWordRight(true)
  } else {
    if (isMeta) editor.moveToLineStart(true)
    else if (event.altKey) editor.moveWordLeft(true)
  }
}

export function handleNavigationKey(event: KeyboardEvent, editor: TextEditor) {
  switch (event.code) {
    case 'ArrowLeft':
    case 'ArrowRight':
      handleHorizontalArrow(event, editor)
      return true
    case 'ArrowUp':
      editor.moveUp(event.shiftKey)
      return true
    case 'ArrowDown':
      editor.moveDown(event.shiftKey)
      return true
    case 'Home':
      editor.moveToLineStart(event.shiftKey)
      return true
    case 'End':
      editor.moveToLineEnd(event.shiftKey)
      return true
    default:
      return false
  }
}
