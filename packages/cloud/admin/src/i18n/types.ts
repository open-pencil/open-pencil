import type {
  accountMessageDefaults,
  adminMessageDefaults,
  authMessageDefaults,
  commonMessageDefaults,
  errorMessageDefaults,
  headMessageDefaults,
  publicMessageDefaults
} from './messages'

type TranslationValues<Defaults> = { [Key in keyof Defaults]-?: string }

export type CloudTranslations = {
  common: TranslationValues<typeof commonMessageDefaults>
  public: TranslationValues<typeof publicMessageDefaults>
  auth: TranslationValues<typeof authMessageDefaults>
  account: TranslationValues<typeof accountMessageDefaults>
  admin: TranslationValues<typeof adminMessageDefaults>
  errors: TranslationValues<typeof errorMessageDefaults>
  head: TranslationValues<typeof headMessageDefaults>
}
