#!/usr/bin/env bash
# guard-claim.sh — hook PreToolUse générique : interdit de travailler sur un
# ticket sans claim commité. Sans référence à un produit ou un plugin.
#
# Principe appliqué : « claim = commit = lock ». On ne modifie pas un ticket
# non réclamé, et on ne produit pas de livrable tant qu'un claim en cours n'est
# pas commité.
#
# Câblage : hook PreToolUse de l'agent (voir la couche locale pour un exemple
# de settings.json). Entrée : JSON du hook sur stdin (tool_name +
# tool_input.file_path ou notebook_path). Sortie : exit 0 = autorisé ; exit 2 =
# bloqué (la raison, sur stderr, est renvoyée à l'agent). Une cible hors du
# dépôt qui porte la file n'est jamais bloquée.
#
# Configuration : QUEUE_DIR (racine de la file) via l'environnement. Si non
# défini, ou si tickets/ est introuvable, le hook n'intervient pas (exit 0).
set -euo pipefail

payload="$(cat || true)"

QUEUE_DIR="${QUEUE_DIR:-}"
[ -n "$QUEUE_DIR" ] || exit 0
[ -d "$QUEUE_DIR/tickets" ] || exit 0

extraire() { # $1 = clé JSON ; lit $payload
  printf '%s' "$payload" \
    | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -n1 \
    | sed -E "s/.*:[[:space:]]*\"([^\"]*)\"/\1/"
}

tool_name="$(extraire tool_name)"

# Seuls les outils de mutation de fichier sont gardés. Les commandes shell
# (git mv, git commit du claim lui-même) et les lectures passent librement.
case "$tool_name" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *) exit 0 ;;
esac

file_path="$(extraire file_path || true)"
# NotebookEdit désigne sa cible par notebook_path, pas par file_path.
[ -n "$file_path" ] || file_path="$(extraire notebook_path || true)"
# Un chemin Windows arrive échappé en JSON (`C:\\dev\\…`) : on ramène tout
# séparateur, simple ou doublé, à `/` avant de comparer. Sans cela, l'édition
# d'un ticket non réclamé passait sous Windows (constaté le 12/11/2026).
file_path="$(printf '%s' "$file_path" | tr '\\' '/' | tr -s '/')"

# Forme comparable d'un chemin : `C:/x` devient `/c/x` (le bash de Git voit les
# disques ainsi) et la casse est ignorée, comme sur un poste Windows.
comparable() {
  printf '%s' "$1" | sed -E 's#^([A-Za-z]):/#/\1/#' | tr 'A-Z' 'a-z'
}

# Racine du dépôt qui porte la file ; à défaut de git, la file elle-même.
racine="$QUEUE_DIR"
if git -C "$QUEUE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  racine="$(git -C "$QUEUE_DIR" rev-parse --show-toplevel)"
fi

# 0) Une écriture dont la cible est hors du dépôt de la file (dossier temporaire
#    de session, autre projet) n'est ni un livrable de la file ni un ticket : un
#    ticket non commité d'un autre agent ne la retient pas. Une cible inconnue
#    ou relative reste gardée, par prudence.
case "$file_path" in
  /*|[A-Za-z]:/*)
    cible_c="$(comparable "$file_path")"
    racine_c="$(comparable "$racine")"
    case "$cible_c/" in
      "$racine_c"/*) ;;
      *) exit 0 ;;
    esac
    ;;
esac

# 1) Interdit : éditer un ticket EXISTANT encore dans a-faire/ (le claim d'abord).
#    Créer un nouveau ticket (le fichier n'existe pas encore) reste autorisé.
case "$file_path" in
  *"/tickets/a-faire/"*)
    if [ -e "$file_path" ]; then
      echo "GUARD: édition d'un ticket non réclamé ($file_path)." >&2
      echo "Claim d'abord : git mv vers tickets/en-cours/ puis commit 'claim: <id> par <agent>'." >&2
      exit 2
    fi
    ;;
esac

# 2) Interdit : produire du travail tant qu'un claim est en cours mais non
#    commité (git mv non suivi d'un commit). Le claim doit être commité avant.
if git -C "$QUEUE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  dirty="$(git -C "$QUEUE_DIR" status --porcelain -- tickets/ 2>/dev/null || true)"
  if [ -n "$dirty" ]; then
    echo "GUARD: changements non commités dans tickets/ — un claim doit être commité avant tout travail (claim = commit = lock)." >&2
    printf '%s\n' "$dirty" >&2
    exit 2
  fi
fi

exit 0
