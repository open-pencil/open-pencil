import type { LandingMessages } from './types'

export const fr: LandingMessages = {
  hero: {
    title: 'Le design sans verrouillage.',
    lede: 'Un éditeur de design open source qui ouvre vos fichiers Figma, tourne sur votre machine et vous laisse, vous ou votre agent AI, piloter chaque calque.',
    open: 'Ouvrir l’éditeur',
    download: 'Télécharger',
    github: 'GitHub'
  },
  loading: 'Chargement de l’éditeur',
  features: {
    figma: {
      title: 'Ouvrez ce que vous avez déjà',
      detail:
        'OpenPencil lit directement les fichiers .fig : pages, composants, instances, variables et auto layout arrivent en calques modifiables, et vous pouvez réenregistrer en .fig. Collez du SVG ou ouvrez du HTML et du CSS, et ils deviennent aussi des calques, disposés comme un navigateur les dispose.',
      hint: 'C’est un vrai fichier .fig. Dépliez les calques et explorez.'
    },
    design: {
      title: 'Concevez avec de vrais outils',
      detail:
        'Auto-layout, contraintes, remplissages, contours, effets et typographie, avec les commandes là où vous les attendez. Tout est annulable, et rien n’attend un serveur.',
      hint: 'Sélectionnez un calque et modifiez son remplissage, son rayon ou sa marge intérieure.'
    },
    interactive: {
      title: 'Des composants qui fonctionnent',
      detail:
        'Donnez un comportement à un composant, comme un interrupteur, une case à cocher, un curseur, des onglets ou un champ de texte, et l’aperçu l’exécute comme un vrai contrôle Reka UI. Les variantes deviennent ses états, et les mêmes composants s’exportent vers Storybook avec des contrôles cliquables.',
      hint: 'Ce canevas est en aperçu : basculez l’interrupteur, faites glisser le curseur. Quittez l’aperçu pour modifier.'
    },
    tokens: {
      title: 'Les variables sont des design tokens',
      detail:
        'Couleurs, espacements et typographie vivent dans des collections avec des modes et se modifient comme des tokens. Le code exporté écrit les valeurs liées comme propriétés personnalisées CSS, si bien que le code reprend les noms du design.',
      hint: 'Modifiez la valeur d’un token ou changez de mode, et chaque calque qui y est lié suit.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil vérifie le design pendant que vous travaillez : contraste, texte trop petit, noms par défaut, calques masqués et vides, groupes superflus. Les problèmes sont signalés sur le canevas, beaucoup se corrigent en un clic, et les mêmes règles tournent dans la CLI et pour les agents.',
      hint: 'Cliquez sur un repère du canevas, ou appliquez une correction depuis la liste.'
    },
    ai: {
      title: 'Concevez avec l’AI, avec vos clés',
      detail:
        'Demandez en langage courant : l’agent modifie le document avec les mêmes outils que vous et affiche son travail sur le canevas au fil de la génération. Connectez le fournisseur de votre choix avec votre propre clé, ou utilisez l’agent de code que vous employez déjà.',
      hint: 'Un échange enregistré passe par la vraie boucle de l’agent. Regardez le canevas se construire au fil du flux.'
    },
    collab: {
      title: 'Travailler ensemble, humains et agents',
      detail:
        "Partagez un lien et tout le monde modifie le même document, de pair à pair, avec curseurs en direct, mode suivi, commentaires épinglés aux calques et appels vocaux. Les agents d'IA rejoignent la salle de la même façon : tout le monde les regarde construire pendant qu'ils diffusent.",
      hint: 'Les deux écrans sont à vous. Faites glisser un calque sur l’un et regardez-le bouger sur l’autre, puis sollicitez l’agent.'
    },
    code: {
      title: 'Du design au code',
      detail:
        "Chaque sélection est un composant Vue ou React, avec les variantes en props et Reka UI ou Radix derrière les composants interactifs, ou du HTML, du Tailwind et du design JSX avec les variables écrites en tokens. Les composants s'exportent en stories Storybook, et le design JSX reste lié au canevas : modifiez-le et le canevas suit.",
      hint: 'Passez à React, HTML ou design JSX, ou sélectionnez un autre calque.'
    },
    script: {
      title: 'Tout piloter par script',
      detail:
        'La CLI openpencil travaille sur un fichier sans que l’application soit lancée, ou pilote l’application ouverte. Inspectez un document, interrogez-le en XPath, vérifiez-le avec le linter, exportez-le ou exécutez du code de plugin Figma avec eval. Le serveur MCP donne aux agents la même portée via stdio ou HTTP.',
      hint: 'Lancez une commande et observez le canevas.'
    },
    sdk: {
      title: 'Intégrez-le à votre propre produit',
      detail:
        'OpenPencil est autant une boîte à outils qu’une application : un moteur indépendant de tout framework, un SDK Vue sans interface et des paquets distincts pour le graphe de scène et les formats de fichier. Intégrez un canevas à votre produit, générez et vérifiez des designs en CI, ou construisez un autre éditeur sur le même moteur. Chaque canevas de cette page est ce SDK, exécuté dans un site de documentation.',
      hint: 'Le code à côté du canevas suffit pour en monter un.'
    }
  },
  agents: {
    heading: 'Compatible avec',
    rest: 'et tout client MCP'
  },
  commands: {
    cli: '{count} commandes',
    mcp: '{count} outils MCP',
    mcpDetail:
      'Créer, styliser, mettre en page, inspecter et exporter. Chacun est aussi disponible pour l’agent intégré.'
  },
  ownership: {
    title: 'Vos fichiers restent les vôtres',
    items: [
      {
        title: 'Local d’abord',
        detail:
          'Les documents sont des fichiers sur votre disque. Pas de compte, pas de serveur, pas besoin d’internet.'
      },
      {
        title: 'Votre stockage',
        detail: 'Synchronisez via votre propre bucket compatible S3 quand vous le souhaitez.'
      },
      {
        title: 'Formats ouverts',
        detail: 'Exportez en .fig, PDF, PPTX, SVG, HTML et JSX. Partir reste toujours possible.'
      },
      {
        title: 'Sous licence MIT',
        detail: 'L’éditeur, le moteur de rendu, le codec .fig et la CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Feuille de route',
    more: 'Feuille de route complète',
    shipped: {
      label: 'Livré',
      entries: [
        { title: 'Composants interactifs et aperçu' },
        { title: 'Variables comme design tokens' },
        { title: 'Linting avec corrections en un clic' },
        { title: 'Agents AI comme collaborateurs, avec mode suivi' },
        { title: 'Annuler, régénérer et modifier les échanges avec l’AI' },
        { title: 'Code relié aux calques' },
        { title: 'Diff visuel et correctifs' },
        { title: 'Commentaires et appels vocaux dans les salles partagées' },
        { title: "Composants Vue et React dans l'onglet Code" },
        { title: 'Import SVG et HTML en calques modifiables' },
        { title: 'Remplissages par shaders' }
      ]
    },
    now: {
      label: 'En cours',
      entries: [
        { title: 'Design tokens W3C', detail: 'Importer et exporter des tokens au format W3C.' },
        {
          title: 'Storybook à partir de vrais composants',
          detail: 'Des stories qui utilisent Reka UI pour Vue et Radix UI pour React.'
        },
        {
          title: 'Création de composants',
          detail: 'Modification des variantes plus rapide et sélection dans les composants.'
        }
      ]
    },
    next: {
      label: 'Ensuite',
      lead: {
        title: 'OpenPencil auto-hébergé',
        detail:
          'Tout l’espace de travail dans votre propre réseau : synchronisation, partage, commentaires et bibliothèques d’équipe, sans envoyer un fichier à qui que ce soit.',
        features: [
          {
            title: 'Votre stockage',
            detail: 'Les documents restent dans votre bucket, dans votre région.'
          },
          {
            title: 'Votre identité',
            detail: 'Connexion via votre fournisseur OIDC ou SSO, avec des rôles.'
          },
          {
            title: 'Votre réseau',
            detail: 'Un relais de collaboration qui fonctionne derrière votre pare-feu.'
          },
          {
            title: 'Votre exploitation',
            detail: 'Déploiement guidé, mises à niveau, sauvegardes et rétention.'
          }
        ]
      },
      entries: [
        {
          title: 'Historique des versions',
          detail: 'Instantanés automatiques, points de contrôle nommés et restauration.'
        }
      ],
      cloud: {
        title: 'OpenPencil Cloud',
        detail:
          "L'espace hébergé pour les équipes : synchronisation en direct, partage, bibliothèques et IA, sans rien à faire tourner."
      }
    },
    later: {
      label: 'Plus tard',
      entries: [
        {
          title: 'Design systems gouvernés',
          detail: 'Proposer, relire, publier et migrer.'
        },
        {
          title: 'Éditeur intégrable',
          detail: 'Placez l’éditeur de cette page dans votre propre produit.'
        }
      ]
    }
  },
  cloud: {
    badge: 'Accès anticipé',
    title: 'OpenPencil Cloud',
    lede: "L'espace de design de votre équipe, hébergé pour vous. Tout le monde modifie les mêmes fichiers en direct, les partage par lien et conçoit avec l'IA, sans rien à installer ni à faire tourner. Vos fichiers restent ouverts : exportez-les en .fig quand vous voulez.",
    features: [
      {
        title: "Synchronisation d'équipe en temps réel",
        detail:
          'Chaque modification parvient à toute l’équipe dès qu’elle a lieu, sur tous les appareils.'
      },
      {
        title: 'Liens de partage et commentaires',
        detail: 'Envoyez un lien pour relire un design et en discuter directement sur le canevas.'
      },
      {
        title: "Bibliothèques d'équipe",
        detail: 'Publiez composants, styles et tokens une fois et utilisez-les dans chaque fichier.'
      },
      {
        title: 'IA hébergée',
        detail: 'Des agents qui conçoivent avec vous, sans clés d’API à gérer.'
      },
      {
        title: "SSO et contrôles d'administration",
        detail: 'Authentification unique, rôles et contrôle de qui voit quoi.'
      }
    ]
  },
  waitlist: {
    label: 'Adresse e-mail',
    placeholder: 'vous@exemple.fr',
    submit: "Rejoindre la liste d'attente",
    invalid: 'Saisissez une adresse e-mail valide.',
    joined: 'Vous êtes sur la liste',
    joinedDetail: "Nous vous écrirons à l'ouverture d'OpenPencil Cloud.",
    failed: "Impossible de rejoindre la liste d'attente",
    failedDetail: 'Réessayez dans un instant.',
    privacy: "Nous ne vous écrirons qu'au sujet d'OpenPencil Cloud."
  },
  closing: {
    title: 'Emportez vos designs avec vous.',
    download: 'Télécharger OpenPencil',
    docs: 'Lire la documentation',
    cloud: "Rejoindre la liste d'attente Cloud"
  },
  stage: {
    activate: 'Essayer en direct',
    terminal: {
      tree: 'Arborescence des calques',
      restyle: 'Restyler les boutons',
      addPlan: 'Ajouter une offre',
      selection: 'Sélection',
      export: 'Export Tailwind'
    },
    ai: {
      recorded: 'Échange enregistré',
      play: 'Lire',
      replay: 'Rejouer',
      request: 'Ajoute trois garanties sous les offres.',
      reasoning:
        'Les offres sont dans une colonne en auto-layout, donc une rangée de trois cartes peut se placer juste en dessous et suivre la mise en page. Chaque carte aura un titre court et une ligne de détail, avec le fond et l’arrondi des cartes d’offre, pour que la rangée fasse partie de la page.',
      reply:
        'J’ai ajouté une rangée **Guarantees** sous les offres : trois cartes qui reprennent le fond et le rayon des cartes d’offre.'
    },
    collab: {
      you: 'Vous',
      yourScreen: 'Votre écran',
      theirScreen: 'L’écran de Sam',
      askAgent: 'Demander à l’agent'
    },
    sdk: {
      copy: 'Copier',
      copied: 'Copié',
      install: 'Installer'
    }
  }
}
