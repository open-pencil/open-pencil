import type { ComputedRef, InjectionKey } from 'vue'
import { inject, provide } from 'vue'

import type { ChannelSliderOrientation } from '#vue/primitives/ChannelSlider/types'

interface ChannelSliderContext {
  value: ComputedRef<number>
  label: ComputedRef<string>
  valueText: ComputedRef<string>
  min: ComputedRef<number>
  max: ComputedRef<number>
  step: ComputedRef<number>
  disabled: ComputedRef<boolean>
  orientation: ComputedRef<ChannelSliderOrientation>
}

const CHANNEL_SLIDER_KEY: InjectionKey<ChannelSliderContext> = Symbol('ChannelSlider')

export function provideChannelSlider(context: ChannelSliderContext) {
  provide(CHANNEL_SLIDER_KEY, context)
}

export function useChannelSlider(): ChannelSliderContext {
  const context = inject(CHANNEL_SLIDER_KEY)
  if (!context)
    throw new Error('[lawha] ChannelSlider part must be used inside ChannelSliderRoot')
  return context
}
