# Gestion des dépendances — projet ITAM

Ce document décrit la procédure de surveillance et de mise à jour des
dépendances tierces des trois composants du projet. Il fait foi pour
`itam_api`, `itam_app` et `itam_web`.

Dernière révision : août 2026.

---

## 1. Périmètre

| Dépôt | Écosystème | Manifeste | Verrou | Directes (prod / dev) |
|---|---|---|---|---|
| `itam_api` | npm | `package.json` | `package-lock.json` | 14 / 24 |
| `itam_app` | pub | `pubspec.yaml` | `pubspec.lock` | 21 / 6 |
| `itam_web` | pub | `pubspec.yaml` | `pubspec.lock` | 10 / 5 |
| Les trois | GitHub Actions | `.github/workflows/` | — | actions de la chaîne CI |

Les actions GitHub font partie du périmètre : elles constituent du logiciel
tiers exécuté à chaque intégration.

**Les fichiers de verrouillage sont versionnés.** Ils figent l'arbre
transitif complet et garantissent que deux installations successives
produisent des dépendances identiques. Ne jamais les ajouter au
`.gitignore`.

---

## 2. Contraintes de version

### Manifestes

Les dépendances sont déclarées avec le préfixe `^` (SemVer compatible),
autorisant correctifs et versions mineures sans modification du manifeste.

### Contrainte SDK (clients Flutter)

```yaml
environment:
  sdk: '>=3.11.1 <3.12.0'
```

La borne haute est **volontairement stricte**. Une contrainte ouverte
(`<4.0.0`) autoriserait la résolution de paquets exigeant un SDK plus
récent que celui fourni par la chaîne de construction, et reporterait
l'échec de la résolution vers la compilation.

**Règle** : toute montée de la borne haute doit être précédée d'une montée
de la version de Flutter épinglée dans les workflows.

### Chaîne de construction

Les workflows épinglent une **version exacte** de Flutter et de Node,
jamais un canal (`stable`, `latest`). Deux exécutions séparées dans le
temps doivent produire le même artefact.

---

## 3. Fréquence, périmètre, type

| Mécanisme | Périmètre | Fréquence | Type |
|---|---|---|---|
| Alertes de vulnérabilité | Arbre complet (transitives incluses) | Continue | Automatique — notification |
| Mises à jour de version | Correctifs + mineures, hors exclusions | Hebdomadaire, lundi 08:00 | Automatique — pull request |
| Montées majeures | Paquets exclus + ruptures | Mensuelle | Manuel — revue et arbitrage |

La configuration se trouve dans `.github/dependabot.yml`, identique sur
les trois dépôts.

### Regroupement

Correctifs et versions mineures sont regroupés en une pull request par
exécution. Les montées majeures restent individuelles.

*Contrepartie assumée* : en cas d'échec de résolution sur un lot, l'échec
est global et ne désigne pas le paquet fautif. Le diagnostic passe par la
lecture du message du gestionnaire de paquets, qui identifie la contrainte
insatisfaite.

### Paquets exclus de toute mise à jour automatique

Sur `itam_app` et `itam_web` :

```
build_runner            freezed             freezed_annotation
json_serializable       json_annotation     riverpod_generator
riverpod_annotation     flutter_riverpod
```

**Motif** : ces bibliothèques fonctionnent par paires annotation/générateur
et le code compilé dépend des fichiers qu'elles produisent. Monter l'une
sans l'autre rompt la compilation. Leur mise à jour est coordonnée et
manuelle.

---

## 4. Validation avant intégration

| Contrôle | `itam_api` | `itam_app` | `itam_web` |
|---|---|---|---|
| Installation depuis le verrou | CI | CI | local |
| Audit de vulnérabilités (bloquant ≥ high) | CI | *indisponible* | *indisponible* |
| Relevé des versions en retard | CI | CI | local |
| Analyse statique | CI | CI | local |
| Vérification de typage | CI | CI (intégrée) | local |
| Tests | CI — 88 | CI — 147 | *non couvert* |
| Construction | CI | CI (APK) | local |

**`itam_web` n'a pas de chaîne d'intégration continue.** Arbitrage de
périmètre du premier livrable : l'effort a été concentré sur l'API, qui
porte la logique métier, et sur l'application mobile, seul composant
distribué. La mise en place d'une chaîne équivalente est planifiée pour le
second livrable. Les mises à jour y sont **surveillées automatiquement mais
validées manuellement**.

**L'écosystème pub ne fournit pas de commande d'audit de vulnérabilités**
équivalente à `npm audit`. La couverture sécurité des clients Flutter
repose sur les alertes issues de la base d'avis GitHub, sans contrôle
bloquant en CI.

---

## 5. Procédures

### 5.1 Traiter une pull request automatique

1. Vérifier le statut de la CI.
2. **CI verte, correctif ou version mineure** → relire le diff du verrou, fusionner.
3. **CI verte, version majeure** → lire les notes de version, identifier les
   ruptures d'API, chercher les usages concernés dans le code, fusionner
   seulement après adaptation.
4. **CI rouge** → identifier l'étape en échec avant toute décision
   (§5.2).

### 5.2 Diagnostiquer un échec

| Étape en échec | Cause probable | Action |
|---|---|---|
| Installation / résolution | Contrainte SDK ou conflit entre paquets | Lire le message du résolveur : il nomme la contrainte insatisfaite |
| Audit de sécurité | Nouvelle vulnérabilité publiée | §5.4 |
| Analyse statique | Règle de lint nouvelle ou API dépréciée | Corriger les occurrences, ou désactiver la règle avec justification écrite |
| Génération de code | Incompatibilité annotation/générateur | Vérifier que la paire a bien été montée conjointement |
| Tests | Rupture de comportement | Rupture réelle : ne pas fusionner |
| Construction | Rupture d'API ou exigence plateforme | Adapter le code appelant ou geler la version |

### 5.3 Revue mensuelle

1. Consulter la sortie de l'étape `Check outdated dependencies` dans les
   journaux de CI (`npm outdated` / `flutter pub outdated`).
2. Traiter les paquets exclus de l'automatisation, en montée coordonnée.
3. Sur les clients Flutter : régénérer (`build_runner build
   --delete-conflicting-outputs`), puis `flutter analyze` et
   `flutter test`.
4. Consigner les montées écartées et le motif du report.

### 5.4 Vulnérabilité signalée

| Sévérité | Délai de traitement |
|---|---|
| Critique | Immédiat — la CI de l'API bloque déjà la fusion |
| Haute | Immédiat — la CI de l'API bloque déjà la fusion |
| Modérée | Prochaine revue mensuelle |
| Faible | Suivi, traitement opportuniste |

Procédure sur `itam_api` :

```bash
npm audit                 # constater
npm audit fix             # corriger dans les plages SemVer déclarées
npm test && npm run build # vérifier
```

Si le correctif exige une montée hors plage SemVer, il devient une montée
majeure et suit la procédure §5.1 point 3.

Si aucun correctif n'existe (dépendance transitive non corrigée en amont),
consigner une anomalie décrivant l'exposition réelle et l'arbitrage retenu.

**Note** : le seuil bloquant est fixé à `high`. La publication d'un nouvel
avis peut faire échouer la CI sur une branche sans rapport avec la
vulnérabilité. Ce comportement est **voulu** : l'échec est le signal.

### 5.5 Geler une dépendance

Lorsqu'une montée est écartée durablement :

1. Ajouter le paquet à la liste `ignore` de `.github/dependabot.yml`.
2. Documenter le motif en commentaire dans ce même fichier.
3. Reporter la montée dans les axes d'amélioration du projet.

---

## 6. Historique des arbitrages

| Date | Objet | Décision |
|---|---|---|
| 2026-08 | 24 vulnérabilités détectées à la mise en service de l'audit (1 critique, 12 hautes) | Corrigées par `npm audit fix`, sans modification du manifeste |
| 2026-08 | `riverpod_generator` 4.0.8 — exige Dart ≥ 3.12 | Montée écartée ; contrainte SDK resserrée à `<3.12.0` ; famille de génération de code exclue de l'automatisation |
| 2026-08 | `flutter_lints` 4 → 5 sur `itam_web` | Appliquée ; contrainte SDK relevée conjointement ; 4 anomalies révélées et traitées |
| 2026-08 | `share_plus` 10 → 12 | Montée écartée — rupture d'API (`Share` statique remplacé par `SharePlus.instance`). Reportée en axe d'amélioration |
| 2026-08 | `pubspec.lock` d'`itam_app` exclu par une règle `*.lock` héritée | Règle corrigée, verrou versionné |