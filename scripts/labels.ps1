# Jeu de labels de consignation — ITAM
#
# Quatre axes indépendants et combinables : type, sévérité, composant,
# statut. Un axe manquant se repère d'un coup d'œil sur la liste des
# issues, ce qui n'est pas le cas d'un jeu de labels plat.
#
# Prérequis : gh auth login
# Exécution : .\labels.ps1

$repos = @(
  "ITAMorg/itam_api",
  "ITAMorg/itam_app",
  "ITAMorg/itam_web"
)

$labels = @(
  # Type
  @{ n = "type:anomalie";        c = "d73a4a"; d = "Dysfonctionnement constate" },
  @{ n = "type:evolution";       c = "0e8a16"; d = "Demande d'amelioration" },
  @{ n = "type:dette";           c = "5319e7"; d = "Dette technique" },
  @{ n = "type:securite";        c = "b60205"; d = "Anomalie de securite" },

  # Severite
  @{ n = "S1:bloquante";         c = "b60205"; d = "Service inutilisable ou faille de securite" },
  @{ n = "S2:majeure";           c = "d93f0b"; d = "Fonction essentielle indisponible" },
  @{ n = "S3:mineure";           c = "fbca04"; d = "Dysfonctionnement contournable" },
  @{ n = "S4:cosmetique";        c = "c2e0c6"; d = "Presentation ou confort d'usage" },

  # Composant
  @{ n = "composant:api";        c = "1d4ed8"; d = "itam_api" },
  @{ n = "composant:app";        c = "1d76db"; d = "itam_app" },
  @{ n = "composant:web";        c = "5bc0de"; d = "itam_web" },

  # Statut
  @{ n = "statut:a-qualifier";   c = "ededed"; d = "En attente de qualification" },
  @{ n = "statut:qualifiee";     c = "bfd4f2"; d = "Reproduite et priorisee" },
  @{ n = "statut:en-cours";      c = "0052cc"; d = "Correction engagee" },
  @{ n = "statut:a-verifier";    c = "fef2c0"; d = "Corrigee, en attente de verification" },
  @{ n = "statut:rejetee";       c = "cccccc"; d = "Non reproductible ou hors perimetre" }
)

foreach ($repo in $repos) {
  Write-Host "=== $repo ===" -ForegroundColor Cyan
  foreach ($l in $labels) {
    gh label create $l.n --repo $repo --color $l.c --description $l.d --force
  }
}

Write-Host "`nTermine." -ForegroundColor Green
