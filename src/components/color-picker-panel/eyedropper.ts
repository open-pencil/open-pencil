import { useEditor } from '@open-pencil/vue'
import { pressAnswersEyedropper } from '@open-pencil/vue/canvas/eyedropper'
import type { PickerKeepOpen } from '@open-pencil/vue/primitives/ColorPicker'

/**
 * A document color picker's `keepOpen`: the caller's own rule, plus the canvas press that answers
 * the picker's eyedropper, so sampling a color does not close the picker.
 */
export function useEyedropperKeepOpen(
  keepOpen: () => PickerKeepOpen | undefined = () => undefined
): PickerKeepOpen {
  const editor = useEditor()
  return (event) => keepOpen()?.(event) === true || pressAnswersEyedropper(editor, event)
}
