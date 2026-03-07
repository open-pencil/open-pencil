# Feuille de route

## Phases

### Phase 1 : Moteur Core ✅

SceneGraph, rendu Skia, formes de base, sélection, zoom/pan, annuler/rétablir, guides d'alignement.

### Phase 2 : UI Éditeur + Layout ✅

Vue 3 + Reka UI panels, propriétés, calques, barre d'outils, Yoga auto-layout, édition de texte en ligne, règles du canevas.

### Phase 3 : E/S Fichiers + Fonctionnalités Visuelles ✅

Import/export .fig, codec Kiwi, presse-papiers, outil plume, réseaux vectoriels, groupes, Tauri v2 bureau, sections, multi-pages, surbrillance au survol, rendu Tier 1.

### Phase 4 : Composants + Variables ✅

Composants, instances, surcharges, jeux de composants, variables (COLOR/FLOAT/STRING/BOOLEAN), collections, modes, export d'images, menu contextuel, formatage de texte riche.

### Phase 5 : Intégration IA & Outils ✅

**Livré :**
- @open-pencil/core extrait dans packages/core/ (aucune dépendance DOM)
- @open-pencil/cli avec opérations headless .fig (info, tree, find, export, analyze, eval)
- Commande `eval` avec API Plugin compatible Figma
- Chat IA : connexion directe OpenRouter, 75 outils dans `schema.ts`, ⌘J
- 49 outils IA/MCP additionnels portés depuis figma-use (75 au total)
- Serveur MCP (@open-pencil/mcp) : stdio + HTTP, 75 outils core + 3 gestion de fichiers
- Définitions d'outils unifiées : définir une fois dans `schema.ts`, adapter pour chat IA (valibot), MCP (zod), CLI (eval)
- Barre de menus pour le mode navigateur
- Sauvegarde automatique : écriture avec debounce de 3s
- Panneau de propriétés multi-sélection avec valeurs partagées/mixtes

**Planifié :**
- Mode attaché : WebSocket vers l'éditeur en cours d'exécution
- Système de directives de conception

### Phase 6 : Collaboration + Distribution 🟡

**Livré :**
- Collaboration P2P via Trystero (WebRTC) + Yjs CRDT — sans serveur relais
- Protocole d'awareness : curseurs en direct, sélections, présence
- Mode suivi : clic sur l'avatar d'un pair pour suivre son viewport
- Persistance locale via y-indexeddb
- Rendu des effets : ombre portée, ombre intérieure, flou de calque/arrière-plan/premier plan
- Onglets multi-fichiers : ⌘N/⌘T nouvel onglet, ⌘W fermer, ⌘O ouvrir
- Signature de code Apple et notarisation pour macOS
- Builds Linux (x64) ajoutés au CI
- Site de documentation VitePress avec i18n (6 langues)

**Planifié :**
- Prototypage (connexions de frames, transitions, animations)
- Commentaires (pin, fils, résoudre)
- Support PWA
- Changement de variantes, UI variables FLOAT/STRING/BOOLEAN, theming par variables

## Calendrier

| Phase | Durée estimée | Statut |
|-------|--------------|--------|
| Phase 1 : Moteur Core | 3 mois | ✅ Terminée |
| Phase 2 : UI Éditeur + Layout | 3 mois | ✅ Terminée |
| Phase 3 : E/S Fichiers + Fonctionnalités Visuelles | 2 mois | ✅ Terminée |
| Phase 4 : Composants + Variables | 2 mois | ✅ Terminée |
| Phase 5 : Intégration IA & Outils | 2 mois | ✅ Terminée |
| Phase 6 : Collaboration + Distribution | 2 mois | 🟡 En cours |
