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
      title: 'Ouvrez vos fichiers Figma',
      detail:
        'OpenPencil lit directement les fichiers .fig : pages, composants, instances, variables et auto-layout arrivent sous forme de calques modifiables. Le copier-coller fonctionne dans les deux sens, et vous pouvez réenregistrer en .fig.',
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
        'Partagez un lien et chacun modifie le même document, en pair à pair, avec curseurs en direct, sélections et mode suivi. Les agents AI rejoignent de la même façon : vous voyez où ils travaillent, sur chaque écran du salon.',
      hint: 'Les deux écrans sont à vous. Faites glisser un calque sur l’un et regardez-le bouger sur l’autre, puis sollicitez l’agent.'
    },
    code: {
      title: 'Du design au code',
      detail:
        'Chaque sélection est disponible en Tailwind JSX, en HTML ou en JSX de design, avec les variables écrites comme tokens, et les composants s’exportent en stories Storybook. Code et canevas restent liés : sélectionnez une ligne et son calque est sélectionné, modifiez le JSX et le canevas suit.',
      hint: 'Sélectionnez un autre calque et regardez le code suivre.'
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
      ]
    },
    now: {
      label: 'En cours',
      entries: [
        { title: 'Design tokens W3C', detail: 'Importer et exporter des tokens au format W3C.' },
        { title: 'Storybook à partir de vrais composants', detail: 'Des stories qui utilisent Reka UI pour Vue et Radix UI pour React.' },
        { title: 'Création de composants', detail: 'Modification des variantes plus rapide et sélection dans les composants.' },
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
        },
        {
          title: 'OpenPencil Cloud, en option',
          detail:
            'Synchronisation et partage hébergés pour les équipes qui le souhaitent. Jamais obligatoire.'
        }
      ]
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
  closing: {
    title: 'Emportez vos designs avec vous.',
    download: 'Télécharger OpenPencil',
    docs: 'Lire la documentation'
  },
  stage: {
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
        'Les offres sont dans une colonne en auto-layout, donc une rangée de trois cartes peut se placer juste en dessous.',
      reply:
        'J’ai ajouté une rangée **Guarantees** sous les offres : trois cartes qui reprennent le fond et le rayon des cartes d’offre.'
    },
    collab: {
      you: 'Vous',
      yourScreen: 'Votre écran',
      theirScreen: 'L’écran de Sam',
      askAgent: 'Demander à l’agent',
    },
    sdk: {
      copy: 'Copier',
      copied: 'Copié'
    }
  }
}
