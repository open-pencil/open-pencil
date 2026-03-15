# Intégrations externes — Verso

## Services

### MCP Protocol (Model Context Protocol)

| Propriété | Valeur |
|-----------|--------|
| Usage | Communication entre les IDE AI et l'éditeur Verso |
| Type | Protocol stdio (JSON-RPC 2.0) |
| Auth | Aucune (local) |
| SDK | `@modelcontextprotocol/sdk` |
| Documentation | https://modelcontextprotocol.io |

**Notes** : Le MCP server expose 17 tools (batch_design, get_design_context, validate_design...), des resources et des prompts. Il communique avec l'app web via un bridge WebSocket IPC.

### Stripe (Phase 4+)

| Propriété | Valeur |
|-----------|--------|
| Usage | Paiements pour les plans Pro et Team |
| Type | REST API + Webhooks |
| Auth | API Key (secret) |
| Variable d'env | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Documentation | https://stripe.com/docs |

**Notes** : Ne pas implémenter avant la Phase 4. Stripe Checkout pour le paiement, webhooks pour la synchronisation des statuts d'abonnement.

### Lucide React

| Propriété | Valeur |
|-----------|--------|
| Usage | Icônes de l'interface de l'éditeur |
| Type | Bibliothèque de composants React |
| Auth | Aucune |
| Package | `lucide-react` ^0.400+ |

### Convex self-hosted (Phase 5+)

| Propriété | Valeur |
|-----------|--------|
| Usage | Backend temps réel pour auth, teams, templates partagés |
| Type | SDK TypeScript + subscriptions réactives |
| Auth | Admin key |
| Variable d'env | `CONVEX_ADMIN_KEY`, `CONVEX_URL` |
| Documentation | https://docs.convex.dev |

**Notes** : Déployé via Docker sur Coolify. Ne PAS implémenter avant la Phase 5.

### Coolify (Phase 4+)

| Propriété | Valeur |
|-----------|--------|
| Usage | Déploiement self-hosted du site marketing et de la documentation |
| Type | PaaS self-hosted (Docker) |
| Auth | Dashboard admin |
| Sous-domaines | verso.dev, docs.verso.dev, convex.verso.dev (Phase 5) |

## Variables d'environnement

| Variable | Service | Description | Phase |
|----------|---------|-------------|-------|
| `STRIPE_SECRET_KEY` | Stripe | Clé secrète API Stripe | Phase 4+ |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Secret pour valider les webhooks | Phase 4+ |
| `CONVEX_ADMIN_KEY` | Convex | Clé admin du backend Convex | Phase 5+ |
| `CONVEX_URL` | Convex | URL du backend Convex self-hosted | Phase 5+ |

> **Sécurité** : Ne JAMAIS hardcoder ces valeurs. Toujours utiliser des variables d'environnement.
> Vérifier que `.env` est dans `.gitignore`.
