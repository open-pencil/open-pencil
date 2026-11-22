import type { LandingMessages } from './types'

export const es: LandingMessages = {
  hero: {
    title: 'Diseña sin ataduras.',
    lede: 'Un editor de diseño de código abierto que abre tus archivos de Figma, funciona en tu equipo y permite que tú o tu agente de IA controléis cada capa.',
    open: 'Hacer el recorrido',
    download: 'Descargar',
    github: 'GitHub'
  },
  loading: 'Cargando el editor',
  features: {
    figma: {
      title: 'Abre lo que ya tienes',
      detail:
        'OpenPencil lee archivos .fig directamente: páginas, componentes, instancias, variables y auto layout llegan como capas editables, y puedes volver a guardar en .fig. Pega SVG o abre HTML y CSS, y también se convierten en capas, dispuestas como las dispone un navegador.',
      hint: 'Este es el propio tour de la app, un archivo .fig real. Abre un capítulo en las capas y explora.'
    },
    design: {
      title: 'Diseña con herramientas de verdad',
      detail:
        'Auto layout, restricciones, rellenos, trazos, efectos y tipografía, con los controles donde los esperas. Los componentes tienen slots: una instancia conserva el diseño y aporta su propio contenido. Todo se puede deshacer y nada espera a un servidor.',
      hint: 'Pasa el puntero por la portada seleccionada y arrastra una esquina para redondearla. Los otros reproductores traen su propia portada por el slot Artwork.'
    },
    interactive: {
      title: 'Componentes que funcionan',
      detail:
        'Dale a un componente un comportamiento, como un interruptor, una casilla, un deslizador, pestañas o un campo de texto, y la vista previa lo ejecuta como un control real de Reka UI. Las variantes pasan a ser sus estados, y los mismos componentes se exportan a Storybook con controles en los que se puede hacer clic.',
      hint: 'Este lienzo está en vista previa: pulsa play, arrastra la barra de progreso, activa el modo aleatorio. Sal de la vista previa para editar.'
    },
    tokens: {
      title: 'Las variables son tokens de diseño',
      detail:
        'Colores, espaciados y tipografía viven en colecciones con modos y se editan como tokens. El código exportado escribe los valores vinculados como propiedades personalizadas de CSS, así que el código usa los mismos nombres que el diseño.',
      hint: 'Cada reproductor lee la colección Theme en su propio modo. Cambia el valor de un token y ambos lo siguen.'
    },
    shaders: {
      title: 'Rellenos que se mueven',
      detail:
        'Un shader es un relleno como cualquier otro: elígelo en el selector de relleno, apila efectos, ajusta sus controles o pega un preset de shaders.com. Los archivos guardan un fotograma fijo, así que se abren en cualquier parte, y la vista previa lo reproduce.',
      hint: 'Este lienzo está en vista previa, por eso los shaders se mueven. Sal de la vista previa, selecciona un cuadrado y abre su relleno.'
    },
    linting: {
      title: 'Linting',
      detail:
        'OpenPencil revisa el diseño mientras trabajas: contraste, texto demasiado pequeño, nombres por defecto, capas ocultas y vacías, grupos sobrantes. Los problemas se marcan en el lienzo, muchos se corrigen con un clic, y las mismas reglas funcionan en la CLI y para los agentes.',
      hint: 'Haz clic en una marca del lienzo o aplica una corrección de la lista.'
    },
    ai: {
      title: 'Diseña con IA, con tus claves',
      detail:
        'Pide lo que necesitas con tus propias palabras y el agente edita el documento con las mismas herramientas que tú, mostrando su trabajo en el lienzo a medida que llega. Conecta cualquier proveedor con tu propia clave o usa el agente de programación que ya utilizas.',
      hint: 'Un turno grabado se reproduce con el bucle real del agente. Mira cómo se construye el lienzo mientras llega.'
    },
    collab: {
      title: 'Trabajad juntos, personas y agentes',
      detail:
        'Comparte un enlace y todos editan el mismo documento, de igual a igual, con cursores en vivo, modo seguir, comentarios fijados a las capas y llamadas de voz. Los agentes de IA se unen igual: todos en la sala los ven construir mientras transmiten.',
      hint: 'Las dos pantallas son tuyas. Arrastra una capa en una y mira cómo se mueve en la otra; después pregunta al agente.'
    },
    code: {
      title: 'Del diseño al código',
      detail:
        'Cada selección es un componente de Vue o React, con las variantes como props y Reka UI o Radix detrás de los interactivos, o HTML, Tailwind y design JSX con las variables escritas como tokens. Los componentes se exportan como historias de Storybook, y el design JSX sigue vinculado al lienzo: edítalo y el lienzo lo sigue.',
      hint: 'Cambia a React, HTML o design JSX, o selecciona otra capa.'
    },
    script: {
      title: 'Automatízalo todo',
      detail:
        'La CLI openpencil trabaja sobre un archivo sin que la aplicación esté abierta, o controla la aplicación que tienes en marcha. Inspecciona un documento, consúltalo con XPath, revísalo con el linter, expórtalo o ejecuta código de plugins de Figma con eval. El servidor MCP da a los agentes el mismo alcance por stdio o HTTP.',
      hint: 'Ejecuta un comando y observa el lienzo.'
    },
    sdk: {
      title: 'Intégralo en tu propio producto',
      detail:
        'OpenPencil es tanto un conjunto de herramientas como una aplicación: un motor independiente del framework, un SDK de Vue sin interfaz y paquetes separados para el grafo de escena y los formatos de archivo. Incrusta un lienzo en tu producto, renderiza y revisa diseños en CI o crea otro editor sobre el mismo motor. Cada lienzo de esta página es ese SDK funcionando dentro de un sitio de documentación.',
      hint: 'El código junto al lienzo es todo lo que hace falta para montar uno.'
    }
  },
  agents: {
    heading: 'Funciona con',
    rest: 'y cualquier cliente MCP'
  },
  commands: {
    cli: '{count} comandos',
    mcp: '{count} herramientas MCP',
    mcpDetail:
      'Crear, dar estilo, maquetar, inspeccionar y exportar. Todas están también disponibles para el agente integrado.'
  },
  ownership: {
    title: 'Tus archivos siguen siendo tuyos',
    items: [
      {
        title: 'Primero en local',
        detail:
          'Los documentos son archivos en tu disco. Sin cuenta, sin servidor y sin necesidad de internet.'
      },
      {
        title: 'Tu almacenamiento',
        detail: 'Sincroniza mediante tu propio bucket compatible con S3 cuando lo necesites.'
      },
      {
        title: 'Formatos abiertos',
        detail: 'Exporta a .fig, PDF, PPTX, SVG, HTML y JSX. Siempre puedes irte.'
      },
      {
        title: 'Licencia MIT',
        detail: 'El editor, el motor de renderizado, el códec .fig y la CLI.'
      }
    ]
  },
  roadmap: {
    title: 'Hoja de ruta',
    more: 'Hoja de ruta completa',
    shipped: {
      label: 'Publicado',
      entries: [
        { title: 'OpenPencil Cloud, también autoalojado' },
        { title: 'Pizarras al estilo de FigJam' },
        { title: 'Páginas web desde una URL como capas' },
        { title: 'Fórmulas en variables' },
        { title: 'Fuentes variables, Material Symbols y SF Symbols' },
        { title: 'Vidrio, desenfoque progresivo, ruido y textura' },
        { title: 'Ajustes de imagen' },
        { title: 'La herramienta Escalar' },
        { title: 'Un lienzo más rápido' },
        { title: 'Revisiones de diseño y tus propios prompts de IA' },
        { title: 'Árabe y portugués de Brasil' },
        { title: 'Comentarios y llamadas de voz en salas compartidas' },
        { title: 'Componentes interactivos y vista previa' },
        { title: 'Linting con correcciones en un clic' }
      ]
    },
    now: {
      label: 'Ahora',
      entries: [
        {
          title: 'Color Display P3',
          detail: 'Los documentos se dibujan y exportan en su perfil de color, como en Figma.'
        },
        {
          title: 'Diseñar sobre páginas en ejecución',
          detail: 'Compara las páginas de un proyecto con el diseño y abre pull requests.'
        },
        {
          title: 'OpenPencil en Android',
          detail: 'El editor en teléfonos, tabletas y plegables Android.'
        }
      ]
    },
    next: {
      label: 'Después',
      leads: [
        {
          title: 'OpenPencil en tu teléfono',
          detail:
            'Una app complementaria para iOS y Android, y el propio editor en teléfonos y tabletas.',
          features: [
            {
              title: 'App complementaria',
              detail:
                'Abre archivos de Cloud, sigue una sala en directo y responde a comentarios y agentes.'
            },
            {
              title: 'Vista previa en el dispositivo',
              detail: 'Refleja un marco del escritorio en tu teléfono mientras diseñas.'
            },
            {
              title: 'Diseñar en tabletas',
              detail: 'Entrada táctil y con lápiz, con paneles pensados para pantallas pequeñas.'
            },
            {
              title: 'Los mismos documentos',
              detail: 'El editor y la Cloud que ya usas, no una app aparte.'
            }
          ]
        },
        {
          title: 'Presentaciones',
          detail: 'Presentaciones junto a diseños y pizarras, hechas con tu sistema de diseño.',
          features: [
            {
              title: 'Tus componentes',
              detail:
                'Las presentaciones usan los mismos componentes, variables y bibliotecas que tus diseños.'
            },
            {
              title: 'Vista del presentador',
              detail:
                'Notas del orador, presentación a pantalla completa y un público que sigue en directo.'
            },
            {
              title: 'Archivos de Figma Slides',
              detail: 'Abre y guarda archivos .deck, y exporta a PDF y PowerPoint.'
            },
            {
              title: 'Presentaciones con IA',
              detail:
                'Crea un borrador a partir de un esquema o un documento, con el tema de la presentación.'
            }
          ]
        }
      ],
      entries: [
        {
          title: 'Inicio de sesión único',
          detail: 'OIDC y SSO para equipos, con cuentas de servicio y webhooks.'
        },
        {
          title: 'Proyectos y carpetas',
          detail: 'Organiza los espacios de Cloud, con plantillas y búsqueda.'
        }
      ]
    },
    later: {
      label: 'Más adelante',
      entries: [
        {
          title: 'Sistemas de diseño gobernados',
          detail: 'Proponer, revisar, publicar y migrar.'
        },
        {
          title: 'Editor incrustable',
          detail: 'Lleva el editor de esta página a tu propio producto.'
        },
        { title: 'Prototipado', detail: 'Conexiones, transiciones y superposiciones entre marcos.' }
      ]
    }
  },
  cloud: {
    badge: 'Acceso anticipado',
    title: 'OpenPencil Cloud',
    lede: 'El espacio de diseño de tu equipo, alojado por nosotros. Todos editan los mismos archivos en directo, los comparten con un enlace y diseñan con IA, sin nada que instalar ni mantener. Tus archivos siguen abiertos: expórtalos como .fig cuando quieras.',
    features: [
      {
        title: 'Sincronización del equipo en tiempo real',
        detail: 'Cada cambio llega a todo el equipo al instante, en cualquier dispositivo.'
      },
      {
        title: 'Enlaces para compartir y comentarios',
        detail: 'Envía un enlace para revisar un diseño y coméntalo sobre el lienzo.'
      },
      {
        title: 'Bibliotecas del equipo',
        detail: 'Publica componentes, estilos y tokens una vez y úsalos en todos los archivos.'
      },
      {
        title: 'IA alojada',
        detail: 'Agentes que diseñan contigo, sin claves de API que gestionar.'
      },
      {
        title: 'SSO y controles de administración',
        detail: 'Inicio de sesión único, roles y control de quién ve qué.'
      }
    ]
  },
  waitlist: {
    label: 'Correo electrónico',
    placeholder: 'tu@ejemplo.com',
    submit: 'Unirme a la lista',
    confirmHuman: 'Confirma que eres humano',
    invalid: 'Introduce un correo electrónico válido.',
    joined: 'Revisa tu bandeja de entrada',
    joinedDetail: 'Abre el enlace que te enviamos para confirmar tu dirección.',
    failed:
      'No se pudo contactar con la lista de espera. Comprueba tu conexión e inténtalo de nuevo.',
    privacy: 'Solo te escribiremos sobre OpenPencil Cloud.',
    refused: 'No pudimos confirmar que no eres un bot. Inténtalo de nuevo.',
    limited: 'Demasiados intentos. Inténtalo de nuevo en un minuto.',
    unavailable: 'No puedes unirte desde aquí. Únete en openpencil.dev.'
  },
  closing: {
    title: 'Llévate tus diseños contigo.',
    download: 'Descargar OpenPencil',
    docs: 'Leer la documentación',
    cloud: 'Unirme a la lista de Cloud'
  },
  clipboard: {
    copy: 'Copiar',
    copied: 'Copiado'
  },
  stage: {
    activate: 'Pruébalo en vivo',
    terminal: {
      tree: 'Árbol de capas',
      restyle: 'Cambiar el color de acento',
      addPlayer: 'Añadir un reproductor',
      selection: 'Selección',
      export: 'Exportar a Tailwind'
    },
    ai: {
      recorded: 'Turno grabado',
      play: 'Reproducir',
      replay: 'Repetir',
      request: 'Añade una cola «Up next» junto al reproductor.',
      reasoning:
        'El reproductor está solo en el marco del hero, que coloca a sus hijos en fila, así que una tarjeta añadida ahí queda justo a su lado. Vincularé el fondo, el radio y los colores de texto de la tarjeta a las variables Theme que usa el reproductor, para que cambie con él entre oscuro y claro, y listaré tres pistas, cada una con una portada pequeña, un título y un artista.',
      reply:
        'He añadido una tarjeta **Up next** junto al reproductor con tres pistas. Sus colores y su radio vienen de las variables Theme, así que sigue al reproductor entre oscuro y claro.'
    },
    collab: {
      you: 'Tú',
      yourScreen: 'Tu pantalla',
      theirScreen: 'Pantalla de Sam',
      askAgent: 'Preguntar al agente'
    },
    sdk: {
      install: 'Instalar'
    }
  },
  download: {
    title: 'Descargar OpenPencil',
    lede: 'La app de escritorio para macOS, Windows y Linux. Gratuita y de código abierto, sin registro.',
    version: 'Versión {version}, publicada el {date}',
    forPlatform: 'Descargar para {platform}',
    moreFiles: 'Más descargas para {platform}',
    releaseNotes: 'Notas de la versión',
    yourSystem: 'Tu sistema',
    arch: {
      appleSilicon: 'Apple Silicon',
      intel: 'Intel',
      x64: 'x64',
      arm: 'ARM'
    },
    formats: {
      dmg: 'Imagen de disco',
      exe: 'Instalador',
      msi: 'Para instalaciones gestionadas',
      appimage: 'Funciona en la mayoría de distribuciones',
      deb: 'Debian, Ubuntu',
      rpm: 'Fedora, openSUSE'
    },
    requirements: 'Requisitos del sistema',
    allTitle: 'Todas las descargas',
    checksums: 'Sumas de comprobación SHA-256',
    onGitHub: 'Versión en GitHub',
    unavailable:
      'No se pudo cargar la lista de descargas. Todos los archivos están en la página de versiones en GitHub.',
    others: {
      title: 'Otras formas de obtenerlo',
      homebrew: {
        title: 'Homebrew',
        detail:
          'La app de macOS firmada, desde el cask oficial. Homebrew revisa cada actualización, así que puede llegar un poco más tarde que aquí.'
      },
      web: {
        title: 'En el navegador',
        detail: 'El mismo editor en app.openpencil.dev, sin instalar nada.',
        action: 'Abrir la app web'
      },
      cli: {
        title: 'Línea de comandos',
        detail: 'Inspecciona, exporta, revisa y automatiza archivos .fig sin abrir la app.'
      },
      source: {
        title: 'Desde el código fuente',
        detail: 'Compila la app tú mismo con Bun y Rust.',
        action: 'Instrucciones de compilación'
      }
    },
    beta: {
      badge: 'Beta',
      title: 'Prueba lo que viene',
      lede: 'Las betas traen antes las funciones de la próxima versión, antes de que lleguen a todos.',
      caveats: [
        'Una app con la versión estable no se actualiza a una beta; instala la beta para probarla.',
        'En Linux, quita una beta instalada con .deb o .rpm antes de instalar la versión final.',
        'Las betas de la CLI y el SDK están en npm con la etiqueta next.'
      ],
      notes: 'Novedades'
    }
  }
}
