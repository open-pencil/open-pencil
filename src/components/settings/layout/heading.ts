import { inject, provide, type InjectionKey } from 'vue'

/**
 * The heading a settings section's title is. Under the settings dialog's own title it is `h3`; a
 * page whose title is its `h1`, such as the Cloud console, makes its sections `h2`, so no heading
 * level is skipped.
 */
export type SettingsSectionHeading = 'h2' | 'h3'

const SECTION_HEADING: InjectionKey<SettingsSectionHeading> = Symbol('settings-section-heading')

/** Makes the settings sections inside this component's subtree titled with `heading`. */
export function provideSettingsSectionHeading(heading: SettingsSectionHeading): void {
  provide(SECTION_HEADING, heading)
}

/** The heading this settings section's title is: `h3` unless a page above said otherwise. */
export function useSettingsSectionHeading(): SettingsSectionHeading {
  return inject(SECTION_HEADING, 'h3')
}
