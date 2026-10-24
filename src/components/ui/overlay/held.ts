import { computed, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue'

/**
 * What an overlay shows: the source while the overlay is open, and the value it had when it
 * closed while the overlay animates out.
 *
 * An overlay closes by clearing the state it draws, and its exit animation would otherwise draw
 * the cleared content: an empty name, the other variant's labels, a vanished error. Once closed
 * the overlay unmounts, so the held value is never seen. `open` defaults to the source being
 * present, for an overlay whose `open` is that test.
 *
 * The value is taken once per tick, before rendering: a flow that clears its state and then
 * closes in the same tick keeps what the overlay showed before either change.
 */
export function useHeldContent<T>(
  source: MaybeRefOrGetter<T>,
  open: MaybeRefOrGetter<boolean> = () => {
    const value = toValue(source)
    return value !== null && value !== undefined
  }
): ComputedRef<T> {
  const held = shallowRef(toValue(source))
  watch(
    [() => toValue(source), () => toValue(open)],
    ([value, isOpen]) => {
      if (isOpen) held.value = value
    },
    { immediate: true }
  )
  return computed(() => (toValue(open) ? toValue(source) : held.value))
}
