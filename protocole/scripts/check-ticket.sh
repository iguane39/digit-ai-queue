#!/usr/bin/env bash
# check-ticket.sh — validateur de conformité d'un ticket. Générique, sans
# référence à un produit ou une organisation.
#
# Usage:   check-ticket.sh <fichier-ticket.md>
# Sortie:  0 = conforme ; 1 = non conforme ; 2 = erreur d'usage.
#
# Règles vérifiées (voir ../schemas/ticket.md) :
#   - les 6 champs obligatoires sont présents :
#       id, resultat, sources, assigne, statut, limites
#   - aucun champ hors de l'ensemble autorisé
#       (6 obligatoires + 3 optionnels : priorite, echeance, parent)
#   - `resultat` est non vide (definition of done testable)
#   - `assigne` appartient à l'énumération fournie via la variable
#     d'environnement QUEUE_ASSIGNEES (liste séparée par des espaces).
#     Si QUEUE_ASSIGNEES est vide, seule la présence non vide de `assigne`
#     est vérifiée — le protocole reste ainsi utilisable seul.
set -euo pipefail

fichier="${1:-}"
[ -n "$fichier" ] || { echo "usage: check-ticket.sh <fichier-ticket.md>" >&2; exit 2; }
[ -f "$fichier" ] || { echo "ERREUR: fichier introuvable: $fichier" >&2; exit 2; }

obligatoires="id resultat sources assigne statut limites"
optionnels="priorite echeance parent"
autorises="$obligatoires $optionnels"

# --- Extraire le frontmatter (entre les deux premiers ---) ---
fm="$(awk '
  NR==1 && $0 !~ /^---[[:space:]]*$/ { exit }
  /^---[[:space:]]*$/ { c++; if (c==2) exit; if (c==1) next }
  c==1 { print }
' "$fichier")"

if [ -z "$fm" ]; then
  echo "REJET: frontmatter YAML absent ou vide (le fichier doit commencer par --- en première ligne)" >&2
  exit 1
fi

# --- Clés de premier niveau (lignes en colonne 0 de la forme cle:) ---
cles="$(printf '%s\n' "$fm" | grep -E '^[A-Za-z_][A-Za-z0-9_]*:' | sed -E 's/^([A-Za-z_][A-Za-z0-9_]*):.*/\1/' || true)"

erreurs=0

# 1) champs obligatoires présents
for champ in $obligatoires; do
  if ! printf '%s\n' "$cles" | grep -qx "$champ"; then
    echo "REJET: champ obligatoire manquant: $champ" >&2
    erreurs=1
  fi
done

# 2) aucun champ hors de l'ensemble autorisé
while IFS= read -r c; do
  [ -n "$c" ] || continue
  ok=0
  for a in $autorises; do [ "$c" = "$a" ] && ok=1 && break; done
  if [ "$ok" -eq 0 ]; then
    echo "REJET: champ non autorisé: '$c' (autorisés: $autorises)" >&2
    erreurs=1
  fi
done <<EOF
$cles
EOF

# 3) resultat non vide (valeur inline ou bloc indenté)
val_resultat="$(printf '%s\n' "$fm" | sed -n -E 's/^resultat:[[:space:]]*(.*)$/\1/p' | head -n1)"
if [ "$val_resultat" = ">" ] || [ "$val_resultat" = "|" ] || [ -z "${val_resultat//[[:space:]]/}" ]; then
  bloc="$(printf '%s\n' "$fm" | awk '
    /^resultat:/ { f=1; next }
    f && /^[A-Za-z_][A-Za-z0-9_]*:/ { exit }
    f && /[^[:space:]]/ { print }
  ')"
  if [ -z "$bloc" ]; then
    echo "REJET: champ resultat vide (definition of done requise)" >&2
    erreurs=1
  fi
fi

# 4) assigne dans l'énumération (si fournie)
val_assigne="$(printf '%s\n' "$fm" | sed -n -E 's/^assigne:[[:space:]]*([^[:space:]#]+).*$/\1/p' | head -n1)"
if [ -z "$val_assigne" ]; then
  echo "REJET: champ assigne vide" >&2
  erreurs=1
elif [ -n "${QUEUE_ASSIGNEES:-}" ]; then
  ok=0
  for a in $QUEUE_ASSIGNEES; do [ "$val_assigne" = "$a" ] && ok=1 && break; done
  if [ "$ok" -eq 0 ]; then
    echo "REJET: assigne='$val_assigne' hors énumération (QUEUE_ASSIGNEES='$QUEUE_ASSIGNEES')" >&2
    erreurs=1
  fi
else
  echo "NOTE: QUEUE_ASSIGNEES non défini — énumération non vérifiée (seule la présence de 'assigne' l'est)" >&2
fi

if [ "$erreurs" -eq 0 ]; then
  echo "OK: ticket conforme ($fichier)"
  exit 0
fi
exit 1
