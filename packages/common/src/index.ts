import {
  type AVAILABLE_LOCALES,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_LINE_HEIGHT,
  DEFAULT_FONT_SIZE
} from './constants'

export { DEFAULT_STROKE_MITER_LIMIT } from './constants'

type AvailableLocale = (typeof AVAILABLE_LOCALES)[number]

export interface Configuration {
  DEFAULT_FONT_FAMILY: string
  DEFAULT_FONT_SIZE: number
  DEFAULT_FONT_LINE_HEIGHT: number
}

const defaultConfiguration: Configuration = {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_LINE_HEIGHT
}

const localeFontFamilyMap: Partial<Record<AvailableLocale, string>> = {
  'zh-CN': 'PingFang SC'
}

class ConfigurationManager {
  private configuration: Configuration

  constructor(defaultConfig: Configuration) {
    this.configuration = {
      ...defaultConfig
    }
  }

  getConfig(): Readonly<Configuration> {
    return {
      ...this.configuration
    }
  }

  updateConfig(config: Partial<Configuration>) {
    this.configuration = {
      ...this.configuration,
      ...config
    }
  }

  resetConfig() {
    this.configuration = {
      ...defaultConfiguration
    }
  }

  updateLocaleConfig(locale: AvailableLocale) {
    this.resetConfig()

    const localeConfig = localeFontFamilyMap[locale] || DEFAULT_FONT_FAMILY

    if (localeConfig) {
      this.updateConfig({
        DEFAULT_FONT_FAMILY: localeConfig
      })
    }
  }
}

export const configurationManager = new ConfigurationManager(defaultConfiguration)
