import {
  DE,
  DE_PROG,
  ES,
  ES_PROG,
  FR,
  FR_PROG,
  IT,
  IT_PROG,
  PL,
  PL_PROG,
  RU,
  RU_PROG
} from '#docs/labels.ts'

import { localeThemeConfig } from './theme.ts'

export const docsLocales = {
  root: {
    label: 'English',
    lang: 'en'
  },
  de: {
    label: 'Deutsch',
    lang: 'de',
    description: 'Open-Source, KI-nativer Design-Editor. Figma-Alternative.',
    themeConfig: localeThemeConfig(
      '/de',
      {
        docs: 'Dokumentation',
        developers: 'Entwickler',
        download: 'Herunterladen',
        reference: 'Referenz',
        development: 'Entwicklung',
        cloud: 'Cloud'
      },
      DE,
      DE_PROG
    )
  },
  it: {
    label: 'Italiano',
    lang: 'it',
    description: 'Editor di design open-source, IA-nativo. Alternativa a Figma.',
    themeConfig: localeThemeConfig(
      '/it',
      {
        docs: 'Documentazione',
        developers: 'Sviluppatori',
        download: 'Scarica',
        reference: 'Riferimento',
        development: 'Sviluppo',
        cloud: 'Cloud'
      },
      IT,
      IT_PROG
    )
  },
  fr: {
    label: 'Français',
    lang: 'fr',
    description: 'Éditeur de design open-source, IA-natif. Alternative à Figma.',
    themeConfig: localeThemeConfig(
      '/fr',
      {
        docs: 'Documentation',
        developers: 'Développeurs',
        download: 'Télécharger',
        reference: 'Référence',
        development: 'Développement',
        cloud: 'Cloud',
        openApp: "Ouvrir l'app"
      },
      FR,
      FR_PROG
    )
  },
  es: {
    label: 'Español',
    lang: 'es',
    description: 'Editor de diseño open-source, IA-nativo. Alternativa a Figma.',
    themeConfig: localeThemeConfig(
      '/es',
      {
        docs: 'Documentación',
        developers: 'Desarrolladores',
        download: 'Descargar',
        reference: 'Referencia',
        development: 'Desarrollo',
        cloud: 'Cloud'
      },
      ES,
      ES_PROG
    )
  },
  pl: {
    label: 'Polski',
    lang: 'pl',
    description: "Open-source'owy edytor graficzny z natywnym AI. Alternatywa dla Figmy.",
    themeConfig: localeThemeConfig(
      '/pl',
      {
        docs: 'Dokumentacja',
        developers: 'Dla programistów',
        download: 'Pobierz',
        reference: 'Referencja',
        development: 'Rozwój',
        cloud: 'Cloud'
      },
      PL,
      PL_PROG
    )
  },
  ru: {
    label: 'Русский',
    lang: 'ru',
    description: 'Дизайн-редактор с открытым исходным кодом. Альтернатива Figma с встроенным ИИ.',
    themeConfig: localeThemeConfig(
      '/ru',
      {
        docs: 'Документация',
        developers: 'Разработчикам',
        download: 'Скачать',
        reference: 'Справочник',
        development: 'Разработка',
        cloud: 'Cloud'
      },
      RU,
      RU_PROG
    )
  }
}
