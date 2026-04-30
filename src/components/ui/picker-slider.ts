import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const pickerSlider = tv({
  slots: {
    root: 'flex items-center gap-2',
    label: 'w-4 shrink-0 text-[10px] font-medium text-muted',
    track: 'relative flex h-3 flex-1 items-center rounded-md',
    gradient: 'absolute inset-0 rounded-md',
    range: 'absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0',
    thumb:
      'pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-white shadow-sm',
    input: 'w-14 rounded border border-border bg-input px-1 py-0.5 text-right text-xs text-surface'
  },
  variants: {
    checkerboard: {
      true: {
        track:
          'bg-[var(--color-checkerboard)] bg-[image:linear-gradient(45deg,var(--color-checkerboard-muted)_25%,transparent_25%),linear-gradient(-45deg,var(--color-checkerboard-muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--color-checkerboard-muted)_75%),linear-gradient(-45deg,transparent_75%,var(--color-checkerboard-muted)_75%)] bg-[size:8px_8px] bg-[position:0_0,0_4px,4px_-4px,-4px_0]'
      },
      false: {}
    }
  },
  defaultVariants: {
    checkerboard: false
  }
})

export type PickerSliderUi = Partial<
  Record<'root' | 'label' | 'track' | 'gradient' | 'range' | 'thumb' | 'input', string>
>

export function usePickerSliderUI(options?: { checkerboard?: boolean; ui?: PickerSliderUi }) {
  const slots = pickerSlider({ checkerboard: options?.checkerboard })
  return {
    root: twMerge(slots.root(), options?.ui?.root),
    label: twMerge(slots.label(), options?.ui?.label),
    track: twMerge(slots.track(), options?.ui?.track),
    gradient: twMerge(slots.gradient(), options?.ui?.gradient),
    range: twMerge(slots.range(), options?.ui?.range),
    thumb: twMerge(slots.thumb(), options?.ui?.thumb),
    input: twMerge(slots.input(), options?.ui?.input)
  }
}
