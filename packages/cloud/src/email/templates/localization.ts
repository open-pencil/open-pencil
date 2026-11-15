import { inject, type InjectionKey } from 'vue'

import type { EmailLocalization } from '../i18n'

/** The reader's language, which every email and its layout write in. */
export const EMAIL_LOCALIZATION: InjectionKey<EmailLocalization> = Symbol('email-localization')

export function useEmailLocalization(): EmailLocalization {
  const localization = inject(EMAIL_LOCALIZATION)
  if (!localization) throw new Error('An email renders inside EmailRoot, which gives its language')
  return localization
}

/** "Hi Ada," or, when the account has no name, "Hi,". */
export function greeting({ t }: EmailLocalization, name: string | null): string {
  return name ? t.greeting({ name }) : t.greetingWithoutName
}
