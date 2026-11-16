import type { docsLocales } from '#docs/locales/docs.ts'

/** What the site header and footer say, in each docs locale. */
export interface SiteMessages {
  tagline: string
  product: string
  openApp: string
  download: string
  cloud: string
  resources: string
  docs: string
  sdk: string
  legal: string
  terms: string
  privacy: string
  security: string
  reportAbuse: string
  /** `{year}` is replaced. */
  copyright: string
  license: string
}

const en: SiteMessages = {
  tagline: 'The open-source design editor. Open your Figma files, own your work.',
  product: 'Product',
  openApp: 'Open the app',
  download: 'Download',
  cloud: 'OpenPencil Cloud',
  resources: 'Resources',
  docs: 'Docs',
  sdk: 'SDK',
  legal: 'Legal',
  terms: 'Terms of service',
  privacy: 'Privacy policy',
  security: 'Security',
  reportAbuse: 'Report abuse',
  copyright: '© {year} OpenPencil',
  license: 'Released under the MIT License.'
}

const de: SiteMessages = {
  tagline: 'Der Open-Source-Design-Editor. Öffne deine Figma-Dateien, behalte deine Arbeit.',
  product: 'Produkt',
  openApp: 'App öffnen',
  download: 'Herunterladen',
  cloud: 'OpenPencil Cloud',
  resources: 'Ressourcen',
  docs: 'Dokumentation',
  sdk: 'SDK',
  legal: 'Rechtliches',
  terms: 'Nutzungsbedingungen',
  privacy: 'Datenschutzerklärung',
  security: 'Sicherheit',
  reportAbuse: 'Missbrauch melden',
  copyright: '© {year} OpenPencil',
  license: 'Veröffentlicht unter der MIT-Lizenz.'
}

const es: SiteMessages = {
  tagline: 'El editor de diseño de código abierto. Abre tus archivos de Figma, tu trabajo es tuyo.',
  product: 'Producto',
  openApp: 'Abrir la app',
  download: 'Descargar',
  cloud: 'OpenPencil Cloud',
  resources: 'Recursos',
  docs: 'Documentación',
  sdk: 'SDK',
  legal: 'Legal',
  terms: 'Términos del servicio',
  privacy: 'Política de privacidad',
  security: 'Seguridad',
  reportAbuse: 'Denunciar abusos',
  copyright: '© {year} OpenPencil',
  license: 'Publicado bajo la licencia MIT.'
}

const fr: SiteMessages = {
  tagline: 'L’éditeur de design open source. Ouvrez vos fichiers Figma, gardez votre travail.',
  product: 'Produit',
  openApp: 'Ouvrir l’app',
  download: 'Télécharger',
  cloud: 'OpenPencil Cloud',
  resources: 'Ressources',
  docs: 'Documentation',
  sdk: 'SDK',
  legal: 'Mentions légales',
  terms: 'Conditions d’utilisation',
  privacy: 'Politique de confidentialité',
  security: 'Sécurité',
  reportAbuse: 'Signaler un abus',
  copyright: '© {year} OpenPencil',
  license: 'Publié sous licence MIT.'
}

const it: SiteMessages = {
  tagline: 'L’editor di design open source. Apri i tuoi file Figma, il tuo lavoro resta tuo.',
  product: 'Prodotto',
  openApp: 'Apri l’app',
  download: 'Scarica',
  cloud: 'OpenPencil Cloud',
  resources: 'Risorse',
  docs: 'Documentazione',
  sdk: 'SDK',
  legal: 'Note legali',
  terms: 'Termini di servizio',
  privacy: 'Informativa sulla privacy',
  security: 'Sicurezza',
  reportAbuse: 'Segnala un abuso',
  copyright: '© {year} OpenPencil',
  license: 'Rilasciato con licenza MIT.'
}

const pl: SiteMessages = {
  tagline: 'Edytor projektów open source. Otwieraj pliki Figmy, Twoja praca należy do Ciebie.',
  product: 'Produkt',
  openApp: 'Otwórz aplikację',
  download: 'Pobierz',
  cloud: 'OpenPencil Cloud',
  resources: 'Zasoby',
  docs: 'Dokumentacja',
  sdk: 'SDK',
  legal: 'Informacje prawne',
  terms: 'Warunki korzystania',
  privacy: 'Polityka prywatności',
  security: 'Bezpieczeństwo',
  reportAbuse: 'Zgłoś nadużycie',
  copyright: '© {year} OpenPencil',
  license: 'Udostępniono na licencji MIT.'
}

const ru: SiteMessages = {
  tagline: 'Редактор дизайна с открытым кодом. Открывайте файлы Figma, ваша работа остаётся вашей.',
  product: 'Продукт',
  openApp: 'Открыть приложение',
  download: 'Скачать',
  cloud: 'OpenPencil Cloud',
  resources: 'Ресурсы',
  docs: 'Документация',
  sdk: 'SDK',
  legal: 'Правовая информация',
  terms: 'Условия использования',
  privacy: 'Политика конфиденциальности',
  security: 'Безопасность',
  reportAbuse: 'Сообщить о нарушении',
  copyright: '© {year} OpenPencil',
  license: 'Распространяется по лицензии MIT.'
}

/** Keyed by the docs locale index, as `useData().localeIndex` gives it; `root` is English. */
export const SITE_MESSAGES: Record<keyof typeof docsLocales, SiteMessages> = {
  root: en,
  de,
  es,
  fr,
  it,
  pl,
  ru
}
