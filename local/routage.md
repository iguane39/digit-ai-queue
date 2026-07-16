# Règle de routage (spécifique à cette instance)

Qui traite quel type de travail. Ce fichier est **local** : il nomme les agents
concrets, contrairement au protocole générique. L'énumération des valeurs
possibles pour le champ `assigne` d'un ticket est tenue en cohérence avec
`QUEUE_ASSIGNEES` dans [`config.env`](config.env).

| Type de travail | Assigné | Pourquoi |
|---|---|---|
| Propales, PPTX, fiches HTML, schémas | `claude` | Dépendent des skills et chartes |
| Prospection, analyses, communication | `claude` | Jugement éditorial + skills |
| Backend / refactoring d'applications | `codex` | Tâches code délimitées, parallélisables |
| Tests, migrations, batch multi-fichiers | `codex` | Exécution dispatchée |
| Review croisée | l'autre agent | Second regard inter-vendor (code ← `claude`, texte technique ← `codex`) |
| Tout ce qui sort vers un tiers | `humain` | Validation finale non délégable |

**Rôle réservé `humain`** : validation finale, envoi vers un tiers, et tout
ticket dont la profondeur de chaîne dépasse `MAX_PROFONDEUR` (garde-fou
anti-boucle, voir `config.env`).
