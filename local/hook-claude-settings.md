# Câblage du guard de claim dans Claude Code

Le hook `protocole/scripts/guard-claim.sh` est **générique** (aucune référence
produit). On le câble côté Claude Code via un hook `PreToolUse`, en lui
passant `QUEUE_DIR`. C'est la couche locale qui fournit le chemin concret.

## Exemple pour `~/.claude/settings.json` (ou le `settings.json` du projet)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "QUEUE_DIR=/c/dev/digit-ai-queue bash /c/dev/digit-ai-queue/protocole/scripts/guard-claim.sh"
          }
        ]
      }
    ]
  }
}
```

## Comportement

- Le hook n'agit que si `QUEUE_DIR` est défini et contient un dossier
  `tickets/` — sinon il laisse tout passer (exit 0). Il est donc sans effet
  hors du contexte de la file.
- Il **bloque** (exit 2, message renvoyé à l'agent) dans deux cas :
  1. édition d'un fichier situé dans `tickets/a-faire/` (claim d'abord) ;
  2. présence de changements non commités dans `tickets/` (un claim doit être
     commité avant tout travail — « claim = commit = lock »).
- Il ne garde que les outils de mutation de fichier. Les commandes shell
  (`git mv`, `git commit` du claim) et les lectures passent librement, sinon le
  claim lui-même serait impossible.

## Installation du skill façade

Le skill `local/skill-digit-ai-queue/` s'installe comme skill Claude Code en le
rendant visible sous `~/.claude/skills/digit-ai-queue/` (copie ou lien) :

```bash
# depuis la racine du repo queue
mkdir -p ~/.claude/skills
cp -r local/skill-digit-ai-queue ~/.claude/skills/digit-ai-queue
```
