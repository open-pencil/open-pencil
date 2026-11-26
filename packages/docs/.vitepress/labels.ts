export interface SidebarLabels {
  getStarted: string
  draw: string
  designSystem: string
  designWithAI: string
  checkAndShare: string
  about: string
  canvasNav: string
  selection: string
  shapes: string
  text: string
  pen: string
  vectorEditing: string
  icons: string
  photos: string
  layers: string
  contextMenu: string
  exporting: string
  autoLayout: string
  components: string
  variables: string
  checkingDesigns: string
  files: string
  componentLibraries: string
  cloudStorage: string
  gettingStarted: string
  features: string
  architecture: string
  techStack: string
  comparison: string
  privacy: string
  figmaMatrix: string
}

export interface ProgrammableLabels {
  overview: string
  cli: string
  inspecting: string
  exporting: string
  analyzing: string
  comparing: string
  appControl: string
  scripting: string
  jsxRenderer: string
  mcpServer: string
  aiChat: string
  collaboration: string
  /** Heads the CLI's command list. */
  commandReference: string
  aiAgents: string
  libraries: string
  /** Heads the collapsed list of how parts of the editor work inside. */
  internals: string
  urlScheme: string
}

export interface NavLabels {
  docs: string
  developers: string
  download: string
  /** Heads the reference pages in each section's sidebar. */
  reference: string
  /** Heads the contributor pages in the Developers sidebar. */
  development: string
  cloud: string
}

export const EN_PROG: ProgrammableLabels = {
  overview: 'Overview',
  cli: 'CLI',
  inspecting: 'Inspecting Files',
  exporting: 'Exporting',
  analyzing: 'Analyzing Designs',
  comparing: 'Comparing Designs',
  appControl: 'Controlling the App',
  scripting: 'Scripting',
  jsxRenderer: 'JSX Renderer',
  mcpServer: 'MCP Server',
  aiChat: 'AI Chat',
  collaboration: 'Collaboration',
  commandReference: 'Command Reference',
  aiAgents: 'AI Agents',
  libraries: 'Libraries',
  internals: 'Internals',
  urlScheme: 'URL Scheme'
}
export const DE_PROG: ProgrammableLabels = {
  overview: 'Überblick',
  cli: 'CLI',
  inspecting: 'Dateien inspizieren',
  exporting: 'Exportieren',
  analyzing: 'Designs analysieren',
  comparing: 'Designs vergleichen',
  appControl: 'App steuern',
  scripting: 'Skripte',
  jsxRenderer: 'JSX-Renderer',
  mcpServer: 'MCP-Server',
  aiChat: 'KI-Chat',
  collaboration: 'Zusammenarbeit',
  commandReference: 'Befehlsreferenz',
  aiAgents: 'KI-Agenten',
  libraries: 'Bibliotheken',
  internals: 'Interna',
  urlScheme: 'URL-Schema'
}
export const IT_PROG: ProgrammableLabels = {
  overview: 'Panoramica',
  cli: 'CLI',
  inspecting: 'Ispezione file',
  exporting: 'Esportazione',
  analyzing: 'Analisi design',
  comparing: 'Confronto dei design',
  appControl: 'Controllare l’app',
  scripting: 'Scripting',
  jsxRenderer: 'Renderer JSX',
  mcpServer: 'Server MCP',
  aiChat: 'Chat IA',
  collaboration: 'Collaborazione',
  commandReference: 'Riferimento comandi',
  aiAgents: 'Agenti IA',
  libraries: 'Librerie',
  internals: 'Dettagli interni',
  urlScheme: 'Schema URL'
}
export const FR_PROG: ProgrammableLabels = {
  overview: 'Vue d’ensemble',
  cli: 'CLI',
  inspecting: 'Inspecter les fichiers',
  exporting: 'Exporter',
  analyzing: 'Analyser les designs',
  comparing: 'Comparer des designs',
  appControl: 'Piloter l’application',
  scripting: 'Scripts',
  jsxRenderer: 'Moteur JSX',
  mcpServer: 'Serveur MCP',
  aiChat: 'Chat IA',
  collaboration: 'Collaboration',
  commandReference: 'Référence des commandes',
  aiAgents: 'Agents IA',
  libraries: 'Bibliothèques',
  internals: 'Fonctionnement interne',
  urlScheme: 'Schéma d’URL'
}
export const ES_PROG: ProgrammableLabels = {
  overview: 'Resumen',
  cli: 'CLI',
  inspecting: 'Inspeccionar archivos',
  exporting: 'Exportar',
  analyzing: 'Analizar diseños',
  comparing: 'Comparar diseños',
  appControl: 'Controlar la app',
  scripting: 'Scripts',
  jsxRenderer: 'Renderizador JSX',
  mcpServer: 'Servidor MCP',
  aiChat: 'Chat IA',
  collaboration: 'Colaboración',
  commandReference: 'Referencia de comandos',
  aiAgents: 'Agentes de IA',
  libraries: 'Bibliotecas',
  internals: 'Funcionamiento interno',
  urlScheme: 'Esquema de URL'
}
export const PL_PROG: ProgrammableLabels = {
  overview: 'Przegląd',
  cli: 'CLI',
  inspecting: 'Inspekcja plików',
  exporting: 'Eksportowanie',
  analyzing: 'Analiza projektów',
  comparing: 'Porównywanie projektów',
  appControl: 'Sterowanie aplikacją',
  scripting: 'Skrypty',
  jsxRenderer: 'Renderer JSX',
  mcpServer: 'Serwer MCP',
  aiChat: 'Czat AI',
  collaboration: 'Współpraca',
  commandReference: 'Opis poleceń',
  aiAgents: 'Agenci AI',
  libraries: 'Biblioteki',
  internals: 'Szczegóły wewnętrzne',
  urlScheme: 'Schemat URL'
}
export const RU_PROG: ProgrammableLabels = {
  overview: 'Обзор',
  cli: 'CLI',
  inspecting: 'Инспекция файлов',
  exporting: 'Экспорт',
  analyzing: 'Анализ дизайна',
  comparing: 'Сравнение дизайнов',
  appControl: 'Управление приложением',
  scripting: 'Скрипты',
  jsxRenderer: 'JSX-рендерер',
  mcpServer: 'MCP-сервер',
  aiChat: 'ИИ-чат',
  collaboration: 'Совместная работа',
  commandReference: 'Справочник команд',
  aiAgents: 'ИИ-агенты',
  libraries: 'Библиотеки',
  internals: 'Внутреннее устройство',
  urlScheme: 'Схема URL'
}

export const EN: SidebarLabels = {
  getStarted: 'Get Started',
  draw: 'Draw',
  designSystem: 'Build a Design System',
  designWithAI: 'Design with AI',
  checkAndShare: 'Check and Share',
  about: 'About OpenPencil',
  canvasNav: 'Canvas Navigation',
  selection: 'Selection & Manipulation',
  shapes: 'Drawing Shapes',
  text: 'Text Editing',
  pen: 'Pen Tool',
  vectorEditing: 'Vector Editing',
  layers: 'Layers & Pages',
  contextMenu: 'Context Menu',
  exporting: 'Exporting',
  autoLayout: 'Auto Layout',
  components: 'Components',
  variables: 'Variables',
  checkingDesigns: 'Checking Designs',
  files: 'Opening and Saving',
  componentLibraries: 'Component Libraries',
  cloudStorage: 'Cloud Storage',
  icons: 'Icons',
  photos: 'Photos',
  gettingStarted: 'Getting Started',
  features: 'Features',
  architecture: 'Architecture',
  techStack: 'Tech Stack',
  comparison: 'Comparison',
  privacy: 'Privacy',
  figmaMatrix: 'Figma Feature Matrix'
}
export const DE: SidebarLabels = {
  getStarted: 'Loslegen',
  draw: 'Zeichnen',
  designSystem: 'Designsystem aufbauen',
  designWithAI: 'Mit KI gestalten',
  checkAndShare: 'Prüfen und teilen',
  about: 'Über OpenPencil',
  canvasNav: 'Canvas-Navigation',
  selection: 'Auswahl & Bearbeitung',
  shapes: 'Formen zeichnen',
  text: 'Textbearbeitung',
  pen: 'Stiftwerkzeug',
  vectorEditing: 'Vektorbearbeitung',
  layers: 'Ebenen & Seiten',
  contextMenu: 'Kontextmenü',
  exporting: 'Exportieren',
  autoLayout: 'Auto-Layout',
  components: 'Komponenten',
  variables: 'Variablen',
  checkingDesigns: 'Designs prüfen',
  files: 'Öffnen und speichern',
  componentLibraries: 'Komponentenbibliotheken',
  cloudStorage: 'Cloud-Speicher',
  icons: 'Symbole',
  photos: 'Fotos',
  gettingStarted: 'Erste Schritte',
  features: 'Funktionen',
  architecture: 'Architektur',
  techStack: 'Tech-Stack',
  comparison: 'Vergleich',
  privacy: 'Datenschutz',
  figmaMatrix: 'Figma-Funktionsmatrix'
}
export const IT: SidebarLabels = {
  getStarted: 'Primi passi',
  draw: 'Disegnare',
  designSystem: 'Creare un design system',
  designWithAI: 'Progettare con l’IA',
  checkAndShare: 'Verificare e condividere',
  about: 'Informazioni su OpenPencil',
  canvasNav: 'Navigazione canvas',
  selection: 'Selezione e manipolazione',
  shapes: 'Disegno forme',
  text: 'Modifica testo',
  pen: 'Strumento penna',
  vectorEditing: 'Modifica vettoriale',
  layers: 'Livelli e pagine',
  contextMenu: 'Menu contestuale',
  exporting: 'Esportazione',
  autoLayout: 'Auto-layout',
  components: 'Componenti',
  variables: 'Variabili',
  checkingDesigns: 'Verificare i design',
  files: 'Aprire e salvare',
  componentLibraries: 'Librerie di componenti',
  cloudStorage: 'Archiviazione cloud',
  icons: 'Icone',
  photos: 'Foto',
  gettingStarted: 'Per iniziare',
  features: 'Funzionalità',
  architecture: 'Architettura',
  techStack: 'Stack tecnologico',
  comparison: 'Confronto',
  privacy: 'Privacy',
  figmaMatrix: 'Matrice funzionalità Figma'
}
export const FR: SidebarLabels = {
  getStarted: 'Bien démarrer',
  draw: 'Dessiner',
  designSystem: 'Créer un design system',
  designWithAI: 'Concevoir avec l’IA',
  checkAndShare: 'Vérifier et partager',
  about: 'À propos d’OpenPencil',
  canvasNav: 'Navigation sur le canevas',
  selection: 'Sélection et manipulation',
  shapes: 'Dessiner des formes',
  text: 'Édition de texte',
  pen: 'Outil plume',
  vectorEditing: 'Édition vectorielle',
  layers: 'Calques et pages',
  contextMenu: 'Menu contextuel',
  exporting: 'Exportation',
  autoLayout: 'Mise en page auto',
  components: 'Composants',
  variables: 'Variables',
  checkingDesigns: 'Vérifier les designs',
  files: 'Ouvrir et enregistrer',
  componentLibraries: 'Bibliothèques de composants',
  cloudStorage: 'Stockage cloud',
  icons: 'Icônes',
  photos: 'Photos',
  gettingStarted: 'Premiers pas',
  features: 'Fonctionnalités',
  architecture: 'Architecture',
  techStack: 'Stack technique',
  comparison: 'Comparaison',
  privacy: 'Confidentialité',
  figmaMatrix: 'Matrice des fonctionnalités Figma'
}
export const ES: SidebarLabels = {
  getStarted: 'Primeros pasos',
  draw: 'Dibujar',
  designSystem: 'Crear un sistema de diseño',
  designWithAI: 'Diseñar con IA',
  checkAndShare: 'Revisar y compartir',
  about: 'Acerca de OpenPencil',
  canvasNav: 'Navegación del lienzo',
  selection: 'Selección y manipulación',
  shapes: 'Dibujar formas',
  text: 'Edición de texto',
  pen: 'Herramienta pluma',
  vectorEditing: 'Edición vectorial',
  layers: 'Capas y páginas',
  contextMenu: 'Menú contextual',
  exporting: 'Exportar',
  autoLayout: 'Auto-layout',
  components: 'Componentes',
  variables: 'Variables',
  checkingDesigns: 'Revisar diseños',
  files: 'Abrir y guardar',
  componentLibraries: 'Bibliotecas de componentes',
  cloudStorage: 'Almacenamiento en la nube',
  icons: 'Iconos',
  photos: 'Fotos',
  gettingStarted: 'Primeros pasos',
  features: 'Características',
  architecture: 'Arquitectura',
  techStack: 'Stack tecnológico',
  comparison: 'Comparación',
  privacy: 'Privacidad',
  figmaMatrix: 'Matriz de funcionalidades Figma'
}
export const PL: SidebarLabels = {
  getStarted: 'Pierwsze kroki',
  draw: 'Rysowanie',
  designSystem: 'Budowanie systemu projektowego',
  designWithAI: 'Projektowanie z AI',
  checkAndShare: 'Sprawdzanie i udostępnianie',
  about: 'O OpenPencil',
  canvasNav: 'Nawigacja po płótnie',
  selection: 'Zaznaczanie i edycja',
  shapes: 'Rysowanie kształtów',
  text: 'Edycja tekstu',
  pen: 'Narzędzie pióro',
  vectorEditing: 'Edycja wektorów',
  layers: 'Warstwy i strony',
  contextMenu: 'Menu kontekstowe',
  exporting: 'Eksportowanie',
  autoLayout: 'Auto-layout',
  components: 'Komponenty',
  variables: 'Zmienne',
  checkingDesigns: 'Sprawdzanie projektów',
  files: 'Otwieranie i zapisywanie',
  componentLibraries: 'Biblioteki komponentów',
  cloudStorage: 'Przechowywanie w chmurze',
  icons: 'Ikony',
  photos: 'Zdjęcia',
  gettingStarted: 'Rozpoczęcie pracy',
  features: 'Funkcje',
  architecture: 'Architektura',
  techStack: 'Stack technologiczny',
  comparison: 'Porównanie',
  privacy: 'Prywatność',
  figmaMatrix: 'Matryca funkcji Figma'
}
export const RU: SidebarLabels = {
  getStarted: 'Начало работы',
  draw: 'Рисование',
  designSystem: 'Дизайн-система',
  designWithAI: 'Дизайн с ИИ',
  checkAndShare: 'Проверка и публикация',
  about: 'Об OpenPencil',
  canvasNav: 'Навигация по холсту',
  selection: 'Выделение и редактирование',
  shapes: 'Рисование фигур',
  text: 'Редактирование текста',
  pen: 'Инструмент «Перо»',
  vectorEditing: 'Редактирование векторов',
  layers: 'Слои и страницы',
  contextMenu: 'Контекстное меню',
  exporting: 'Экспорт',
  autoLayout: 'Авто-раскладка',
  components: 'Компоненты',
  variables: 'Переменные',
  checkingDesigns: 'Проверка дизайна',
  files: 'Открытие и сохранение',
  componentLibraries: 'Библиотеки компонентов',
  cloudStorage: 'Облачное хранилище',
  icons: 'Иконки',
  photos: 'Фото',
  gettingStarted: 'Начало работы',
  features: 'Возможности',
  architecture: 'Архитектура',
  techStack: 'Технологии',
  comparison: 'Сравнение',
  privacy: 'Конфиденциальность',
  figmaMatrix: 'Матрица функций Figma'
}
