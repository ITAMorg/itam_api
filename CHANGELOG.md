# Changelog

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-19

### Sécurité
- Un compte désactivé conserve son accès : trois défauts cumulés corrigés — la connexion ne consultait pas l'indicateur d'activité, le renouvellement de jeton ne relisait jamais l'utilisateur, et la désactivation ne révoquait pas les jetons de rafraîchissement existants. Un compte désactivé en cours de session conservait son accès pendant sept jours.
- Le renouvellement de jeton reconstruit désormais la charge utile depuis l'utilisateur relu en base. Le rattachement au site était omis, ce qui modifiait silencieusement le périmètre de visibilité après le premier renouvellement.
- Les sondes de santé n'exposent plus le détail technique des erreurs de base de données au client.
- Correction de 24 vulnérabilités de dépendances.

### Ajouté
- Sondes de supervision : `GET /health` (vivacité), `GET /health/ready` (aptitude au service, contrôle de la base avec délai borné à 3 s), `GET /metrics` (volumes par classe de statut, latences p50/p95, ventilation par route).
- Journalisation structurée avec identifiant de corrélation restitué au client dans les réponses d'erreur.
- Gestionnaire d'erreurs centralisé : statut HTTP conforme à la nature de l'erreur, aucune fuite de détail d'implémentation.
- Gabarit de consignation d'anomalie et jeu de seize labels harmonisé sur les trois dépôts.
- Suivi automatisé des dépendances (Dependabot) et audit de vulnérabilités bloquant en intégration continue.

### Corrigé
- La réouverture d'un ticket ne remettait plus l'actif en maintenance. La branche traitant ce cas avait été supprimée par inadvertance le 23/07, laissant un actif en intervention marqué comme disponible. La règle est adaptée : la bascule en `BROKEN` est désormais déclenchée par la priorité `HIGH`, la valeur `CRITICAL` ayant été retirée de l'énumération.

### Modifié
- Suite de tests portée à 114 tests répartis sur 7 suites, dont 24 couvrant le dispositif de supervision et 2 la réouverture de ticket.
- Configuration ESLint : les identifiants préfixés par `_` sont admis, la signature à quatre paramètres du gestionnaire d'erreurs Express imposant de conserver un paramètre inutilisé.

## [1.0.0] - 2026-07-18

### Ajouté
- Version finale destinée au dossier RNCP.
- Correction de la logique métier sur la gestion des tickets (transitions d'état, filtrage).
- Suite de 35 tests d'intégration (Jest + Supertest) sur une base PostgreSQL dédiée `itam_test` :
  - 11 tests d'authentification (register, login, refresh, logout, révocation)
  - 12 tests sur les assets (RBAC par location, permissions par rôle, traçabilité lifecycle)
  - 12 tests sur les tickets (filtrage RBAC via relation asset, transitions métier automatisées)
- Infrastructure de test : setup Prisma automatisé, isolation transactionnelle par TRUNCATE, factories réutilisables.

### Modifié
- Ajustements sur la cohérence des statuts de tickets et l'affichage des historiques.

## [0.5.0] - 2026-05-04

### Ajouté
- Endpoints d'agrégation pour le tableau de bord (`/api/stats`).
- Statistiques par statut d'assets, par type de tickets, et par location.

## [0.4.0] - 2026-04-27

### Ajouté
- Finalisation des endpoints consommés par le dashboard `itam_web` et l'application `itam_app`.
- Filtres avancés sur les collections (assets, tickets).
- Génération et scan de QR codes pour les assets (`/api/assets/:id/qrcode`, `/api/assets/scan`).

### Modifié
- Amélioration de la traçabilité des évolutions d'assets via `AssetLifecycle`.

## [0.3.0] - 2026-04-12

### Ajouté
- Gestion complète des tickets : création, assignation, commentaires, changement de statut.
- Enums métier : `TicketStatus`, `TicketPriority`, `TicketType`.
- Job planifié de fermeture automatique des tickets résolus.
- Endpoints `/api/tickets` avec filtres par statut, priorité, assigné.

## [0.2.0] - 2026-03-31

### Ajouté
- Gestion complète des assets : CRUD, filtrage, historique de cycle de vie.
- Modèles Prisma : `Asset`, `AssetType`, `Supplier`, `Location`, `AssetLifecycle`.
- Contrôle d'accès par rôle (RBAC) : ADMIN/TECHNICIAN peuvent modifier, USER lecture seule filtrée par location.
- Endpoints `/api/assets`, `/api/asset-types`, `/api/suppliers`, `/api/locations`.

## [0.1.0] - 2026-03-26

### Ajouté
- Authentification JWT avec refresh tokens persistés en base.
- Endpoints `/api/auth/register`, `/login`, `/refresh`, `/logout`.
- Middleware `authenticate` (vérification token) et `authorize` (contrôle par rôle).
- Modèles Prisma `User` et `RefreshToken`.
- Hashage bcrypt des mots de passe (cost 10).

### Sécurité
- Utilisation de Helmet pour les en-têtes HTTP sécurisés.
- Configuration CORS.
- Séparation des secrets JWT via variables d'environnement.

## [Fondations]

### Ajouté
- Structure du projet Node.js/Express en TypeScript.
- Configuration Prisma avec PostgreSQL.
- Pipeline d'intégration continue (GitHub Actions) : lint, type-check, build.
- Fichier `.env` de configuration avec séparation des environnements.