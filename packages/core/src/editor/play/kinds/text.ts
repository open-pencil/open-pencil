import { booleanBinding, numberSettings } from '@open-pencil/scene-graph'

import { documentPartFrame, withinFrame } from './parts'
import type { PlayControl, PlayInteraction, PlayKey } from './types'

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function characters(text: string): string[] {
  return Array.from(graphemes.segment(text), (part) => part.segment)
}

/** Whether a key types one character, as opposed to naming a key such as `Shift`. */
function isCharacter(key: string): boolean {
  return characters(key).length === 1
}

/** The text without its last character, an emoji or accented letter included. */
function withoutLast(text: string): string {
  return characters(text).slice(0, -1).join('')
}

/**
 * The text a field holds. When a `filled` value draws the empty field (a placeholder variant),
 * the text it shows is the placeholder, so the field holds nothing yet.
 */
function typed({ session, target }: PlayControl): string {
  const showsPlaceholder =
    !!booleanBinding(target.behaviour, 'filled') && !session.getBoolean(target, 'filled')
  return showsPlaceholder ? '' : session.getText(target, 'value')
}

/** Put text in the field; emptied, it shows its placeholder again when it draws one. */
function write({ session, target }: PlayControl, text: string): void {
  const draws = !!booleanBinding(target.behaviour, 'filled')
  if (draws) session.setBoolean(target, 'filled', text !== '')
  session.setText(
    target,
    'value',
    draws && text === '' ? session.designedText(target, 'value') : text
  )
}

/**
 * A text field or textarea: typing adds characters at the end and Backspace removes the last;
 * Enter adds a line in a textarea. A press focuses the field and shows its focus state.
 */
function textInput(multiline: boolean): PlayInteraction {
  return {
    focusOnPress: true,
    key(control) {
      const current = typed(control)
      let next: string | null = null
      if (control.key === 'Backspace') next = withoutLast(current)
      else if (control.key === 'Enter') next = multiline ? `${current}\n` : null
      else if (isCharacter(control.key)) next = current + control.key
      if (next === null) return false
      write(control, next)
      return true
    }
  }
}

export const textField = textInput(false)
export const textarea = textInput(true)

/** The value's text, with as many decimals as the step has. */
function format(value: number, step: number): string {
  const decimals = step > 0 ? (String(step).split('.')[1]?.length ?? 0) : 2
  return value.toFixed(decimals)
}

function setNumber(control: PlayControl, value: number): void {
  const { session, target } = control
  const settings = numberSettings(target.behaviour, 'value')
  const kept = session.setNumber(target, 'value', value)
  if (settings && kept !== null) session.setText(target, 'text', format(kept, settings.step))
}

function step(control: PlayControl, by: number): void {
  const settings = numberSettings(control.target.behaviour, 'value')
  if (!settings) return
  const size = settings.step > 0 ? settings.step : 1
  setNumber(control, control.session.getNumber(control.target, 'value') + by * size)
}

/** Keys of a number field: arrows step, digits and signs edit, Enter settles the text. */
function numberKey(control: PlayKey): boolean {
  const { session, target, key } = control
  const by = control.shift ? 10 : 1
  if (key === 'ArrowUp') step(control, by)
  else if (key === 'ArrowDown') step(control, -by)
  else if (key === 'Enter') setNumber(control, session.getNumber(target, 'value'))
  else if (key === 'Backspace' || /^[\d.,-]$/.test(key)) {
    const current = session.getText(target, 'text')
    const draft = key === 'Backspace' ? withoutLast(current) : current + key
    session.setText(target, 'text', draft)
    const parsed = Number.parseFloat(draft.replace(',', '.'))
    if (Number.isFinite(parsed)) session.setNumber(target, 'value', parsed)
  } else return false
  return true
}

/**
 * A number field: its increment and decrement parts step the value, arrows step it (ten steps
 * with Shift), and typing edits its text; the value keeps the behaviour's range.
 */
export const numberField: PlayInteraction = {
  focusOnPress: true,
  press(pointer) {
    const part = (id: string) =>
      withinFrame(
        pointer.graph,
        documentPartFrame(pointer.graph, pointer.target, id),
        pointer.hitId
      )
    if (part('increment')) step(pointer, 1)
    else if (part('decrement')) step(pointer, -1)
    return false
  },
  key: numberKey
}
