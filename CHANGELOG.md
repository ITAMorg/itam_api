# Changelog

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-04

### Ajouté
- Version finale destinée au dossier RNCP.
- Correction de la logique métier sur la gestion des tickets (transitions d'état, filtrage).

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