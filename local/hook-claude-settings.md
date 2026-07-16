# Câblage du guard de claim dans Claude Code

Le hook `protocole/scripts/guard-claim.sh` est **générique** (aucune référence
produit). On le câble côté Claude Code via un hook `PreToolUse`, en lui
passant `QUEUE_DIR`. C'est la couche locale qui fournit le chemin concret.

## Où le placer : réglages **de projet**, pas globaux

Mets ce hook dans les réglages de projet du repo queue —
`<repo-queue>/.claude/settings.json` — **pas** dans `~/.claude/settings.json`.

Raison : un hook global s'appliquerait à tous tes projets. Comme il inspecte le
`tickets/` de `QUEUE_DIR`, un claim resté non commité dans la file bloquerait
alors tes éditions dans des projets **sans aucun rapport**. En réglages de
projet, le hook n'est actif que quand Claude Code est lancé dans le repo
queue — exactement le contexte où l'on traite des tickets.

## Piège Windows : le bon `bash`

Sur Windows, `where bash` peut renvoyer plusieurs binaires, dont
`C:\Windows\System32\bash.exe` qui est le **bash de WSL**. WSL monte le disque
en `/mnt/c/…`, donc `/c/dev/…` n'y existe pas et le hook échouerait
silencieusement. Il faut donc pointer **explicitement le bash de Git**, en
général `C:/Program Files/Git/usr/bin/bash.exe`.

## Exemple pour `<repo-queue>/.claude/settings.json` (Windows)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "\"C:/Program Files/Git/usr/bin/bash.exe\" -c 'QUEUE_DIR=/c/dev/digit-ai-queue bash /c/dev/digit-ai-queue/protocole/scripts/guard-claim.sh'"
          }
        ]
      }
    ]
  }
}
```

Adapte `QUEUE_DIR` et les chemins à ton installation. Le `bash -c '…'` garantit
que la syntaxe `VAR=val cmd` fonctionne quel que soit le shell qui déclenche le
hook ; le payload JSON de l'outil arrive bien sur l'entrée standard du script à
travers cette chaîne.

## Exemple équivalent sur macOS / Linux

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "QUEUE_DIR=/chemin/vers/repo-queue bash /chemin/vers/repo-queue/protocole/scripts/guard-claim.sh"
          }
        ]
      }
    ]
  }
}
```

Après modification du `settings.json`, **redémarre Claude Code** : les hooks
sont chargés au démarrage.

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

## Tester que le blocage marche

Depuis le repo queue :

```bash
git mv tickets/a-faire/<un-ticket>.md tickets/en-cours/<un-ticket>.md   # claim NON commité
```

Demande ensuite à Claude d'éditer/créer un fichier livrable : le hook doit
refuser avec `GUARD: changements non commités dans tickets/ …`. Annule le test
avec `git mv tickets/en-cours/<un-ticket>.md tickets/a-faire/`, ou commite le
claim pour de bon.

## Installation du skill façade

Le skill `local/skill-digit-ai-queue/` s'installe comme skill Claude Code en le
rendant visible sous `~/.claude/skills/digit-ai-queue/` (le nom du dossier doit
être `digit-ai-queue`, comme le champ `name` du frontmatter). C'est une copie :
après une modification du skill dans le repo, recopie-le.

```bash
# Git Bash, depuis la racine du repo queue
mkdir -p ~/.claude/skills
cp -r local/skill-digit-ai-queue ~/.claude/skills/digit-ai-queue
```

```powershell
# PowerShell
Copy-Item -Recurse "C:\dev\digit-ai-queue\local\skill-digit-ai-queue" "$HOME\.claude\skills\digit-ai-queue"
```

Puis **redémarre la session Claude Code** pour qu'il découvre le skill.
Vérifie en disant « qu'y a-t-il dans la queue » : le skill doit se déclencher.
