---
title: Chat IA
description: Assistant IA intégré avec plus de 90 outils pour créer et modifier des designs.
---

# Chat IA

Appuyez sur <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) pour ouvrir l'assistant IA. Décrivez ce que vous voulez — il crée des formes, définit des styles, gère la mise en page, travaille avec les composants et analyse votre design.

## Configuration

1. Ouvrez le panneau de chat IA (<kbd>⌘</kbd><kbd>J</kbd>)
2. Cliquez sur l'icône de paramètres
3. Choisissez un fournisseur et entrez votre clé API
4. Sélectionnez un modèle

### Fournisseurs pris en charge

| Fournisseur | Modèles | Configuration |
|-------------|---------|---------------|
| **OpenRouter** | Claude, GPT-4, Gemini, DeepSeek et autres | Clé API de [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, etc. | Clé API de [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o, GPT-4, etc. | Clé API de [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 2.0, Gemini 1.5, etc. | Clé API de [aistudio.google.dev](https://aistudio.google.dev) |
| **Compatible OpenAI** | Tout endpoint au format API OpenAI | URL de base personnalisée + clé. Supporte le basculement entre API Completions et Responses. |
| **Compatible Anthropic** | Tout endpoint au format API Anthropic | URL de base personnalisée + clé |

Pas de backend ni d’abonnement : votre clé communique directement avec le fournisseur. Les requêtes du navigateur sont soumises à la politique CORS du fournisseur, et la fiabilité des appels d’outils en streaming varie selon les déploiements. Consultez la référence en anglais sur la [compatibilité des fournisseurs et modèles BYOK](/programmable/byok-provider-compatibility) pour les résultats mesurés et les tests reproductibles.

## Fonctionnalités

L'assistant dispose de plus de 90 outils répartis dans ces catégories :

- **Créer** — frames, formes, texte, composants, pages. Rendu JSX pour les mises en page complexes.
- **Styliser** — remplissages, contours, effets, opacité, rayon d'arrondi, modes de fusion.
- **Mise en page** — auto-layout, grille, alignement, espacement, dimensionnement.
- **Composants** — créer des composants, des instances, des ensembles de composants. Gérer les surcharges.
- **Variables** — créer/modifier des variables, des collections, des modes. Lier aux remplissages.
- **Requêter** — trouver des nœuds, sélecteurs XPath, lire des propriétés, lister les pages, les polices, la sélection.
- **Inspecter** — `get_jsx` pour la vue JSX, `diff_jsx` pour les différences structurelles, `describe` pour le rôle sémantique et les problèmes de design.
- **Analyser** — palette de couleurs, audit typographique, cohérence de l'espacement, détection de motifs récurrents.
- **Exporter** — PNG, SVG, JSX avec classes Tailwind. Vérification visuelle via `export_image`.
- **Vectoriel** — opérations booléennes, manipulation de chemins.

## Vérification visuelle

L'assistant peut vérifier visuellement son travail. Après avoir créé ou modifié des designs, il utilise `export_image` pour capturer une image et vérifier le résultat par rapport à la demande initiale.

## Exemples de prompts

- « Créer une carte avec un titre, une description et un bouton bleu »
- « Faire en sorte que tous les boutons de cette page utilisent le même rayon d'arrondi »
- « Quelles polices sont utilisées dans ce fichier ? »
- « Changer l'arrière-plan du frame sélectionné en un dégradé du bleu au violet »
- « Exporter le frame sélectionné en SVG »
- « Montre-moi le JSX de ce frame »

## Conseils

- Sélectionnez des nœuds avant de poser votre question — l'assistant sait ce qui est sélectionné.
- Soyez précis sur les couleurs, tailles et positions pour des résultats exacts.
- L'assistant peut modifier plusieurs nœuds en un seul message.
- Utilisez « annuler » dans l'éditeur — les mutations IA supportent l'annulation complète.
- Tous les layouts sont recalculés automatiquement après chaque exécution d'outil.
