import { useStore } from '@nanostores/vue'

import {
  accountMessages,
  adminMessages,
  authMessages,
  commonMessages,
  errorMessages,
  headMessages,
  publicMessages
} from './create'
import { cloudLocale, setCloudLocale, CLOUD_LOCALES } from './locale'

export function useCloudI18n() {
  return {
    account: useStore(accountMessages),
    admin: useStore(adminMessages),
    auth: useStore(authMessages),
    common: useStore(commonMessages),
    errors: useStore(errorMessages),
    head: useStore(headMessages),
    public: useStore(publicMessages),
    locale: useStore(cloudLocale),
    locales: CLOUD_LOCALES,
    setLocale: setCloudLocale
  }
}
