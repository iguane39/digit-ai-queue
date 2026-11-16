#!/usr/bin/env node
/**
 * recette-protocole.mjs — banc des scripts shell du protocole (garde de claim, validateur de ticket).
 *
 * POURQUOI. `protocole/scripts/*.sh` n'avait aucun banc : une règle de garde ou de validation
 * n'était prouvée que par l'usage. Chaque cas joue le script réel dans un dépôt jetable (hors de
 * l'arbre, sous le dossier temporaire du poste) et lit son code de sortie et sa raison.
 *
 * Usage :
 *   node scripts/recette-protocole.mjs        exit 0 si tous les cas tiennent, 1 sinon
 *
 * Aucun ticket réel de la file n'est lu ni modifié : les tickets des cas sont des fixtures écrites
 * dans les dépôts jetables.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GARDE = join(SOURCE, "protocole", "scripts", "guard-claim.sh");
const VALIDATEUR = join(SOURCE, "protocole", "scripts", "check-ticket.sh");

// Sous Windows, `bash` peut être celui de WSL (System32), qui ne voit pas /c/… : on vise celui de Git.
function trouverBash() {
  if (process.env.BASH_RECETTE) return process.env.BASH_RECETTE;
  for (const c of ["C:/Program Files/Git/usr/bin/bash.exe", "C:/Program Files/Git/bin/bash.exe"]) {
    if (existsSync(c)) return c;
  }
  return "bash";
}
const BASH = trouverBash();

// `C:\x\y` -> `/c/x/y` : la forme que la garde reçoit de son hook (QUEUE_DIR) sous Git Bash.
const posix = (p) => p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, "/");

const IDENT = ["-c", "user.name=recette", "-c", "user.email=recette@example.test", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false"];
function git(dir, ...args) {
  const r = spawnSync("git", [...IDENT, "-C", dir, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} : ${r.stderr}`);
  return r.stdout;
}

function ecrire(chemin, contenu) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu);
}

const TICKET_SUIVI = "tickets/a-faire/T-9999-0101-001.md";
const CORPS_TICKET = (id) => `---\nid: ${id}\nresultat: x\nsources:\n  - y\nassigne: claude\nstatut: a-faire\nlimites: z\n---\n`;

/**
 * Dépôt jetable portant une file. `sous` vaut "" (la file est la racine du dépôt) ou "queue"
 * (instance posée dans un projet, la disposition de l'installateur). Un ticket suivi, propre, y attend
 * dans a-faire/.
 */
function depot(racineTmp, sous = "") {
  const racine = mkdtempSync(join(racineTmp, "depot-"));
  git(racine, "init", "-q");
  const file = sous ? join(racine, sous) : racine;
  for (const e of ["a-faire", "en-cours", "attente-input", "termine"]) ecrire(join(file, "tickets", e, ".gitkeep"), "");
  ecrire(join(file, "recus", ".gitkeep"), "");
  ecrire(join(file, TICKET_SUIVI), CORPS_TICKET("T-9999-0101-001"));
  ecrire(join(racine, "livrable-existant.txt"), "x\n");
  git(racine, "add", "-A");
  git(racine, "commit", "-q", "-m", "état initial de la recette");
  return { racine, file };
}

/** Joue la garde : outil, cible (cle JSON `file_path` ou `notebook_path`), QUEUE_DIR en forme posix. */
function garde({ queueDir, outil = "Edit", cible, cle = "file_path" }) {
  const entree = { tool_name: outil, tool_input: cible === undefined ? {} : { [cle]: cible } };
  const env = { ...process.env };
  delete env.QUEUE_DIR;
  if (queueDir !== undefined) env.QUEUE_DIR = posix(queueDir);
  const r = spawnSync(BASH, [posix(GARDE)], { input: JSON.stringify(entree), encoding: "utf8", env });
  return { code: r.status, err: r.stderr || "" };
}

/** Joue le validateur sur un texte de ticket. */
function valider(racineTmp, texte, env = {}) {
  const f = join(racineTmp, `ticket-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(f, texte);
  const e = { ...process.env, ...env };
  const r = spawnSync(BASH, [posix(VALIDATEUR), posix(f)], { encoding: "utf8", env: e });
  return { code: r.status, err: r.stderr || "", out: r.stdout || "" };
}

let ko = 0;
let total = 0;
function ok(nom, cond, detail = "") {
  total++;
  console.log(`${cond ? "ok  " : "KO  "} ${nom}${cond || !detail ? "" : `\n      ${detail.trim().replace(/\n/g, "\n      ")}`}`);
  if (!cond) ko++;
}

function recette() {
  const tmp = mkdtempSync(join(tmpdir(), "queue-recette-"));
  try {
    // ---- Garde de claim : socle (non-régression) -------------------------------------------------
    {
      const d = depot(tmp);
      const livrable = join(d.racine, "livrable-existant.txt");
      ok("garde : sans QUEUE_DIR, elle n'intervient pas", garde({ cible: livrable }).code === 0);
      ok("garde : un outil de lecture ou de shell passe", garde({ queueDir: d.racine, outil: "Bash", cible: livrable }).code === 0);
      ok("garde : file propre, un livrable dans le dépôt passe", garde({ queueDir: d.racine, cible: livrable }).code === 0);
      const mur = garde({ queueDir: d.racine, cible: join(d.racine, TICKET_SUIVI) });
      ok("garde : un ticket suivi de a-faire/ ne s'édite pas avant son claim", mur.code === 2 && /non réclamé/.test(mur.err), mur.err);

      // claim non commité : git mv sans commit
      git(d.racine, "mv", TICKET_SUIVI, TICKET_SUIVI.replace("a-faire", "en-cours"));
      const bloc = garde({ queueDir: d.racine, cible: livrable });
      ok("garde : claim non commité, un livrable dans le dépôt est refusé", bloc.code === 2 && /non commités/.test(bloc.err), bloc.err);
      git(d.racine, "commit", "-q", "-m", "claim: T-9999-0101-001 par recette");
      ok("garde : claim commité, le livrable passe", garde({ queueDir: d.racine, cible: livrable }).code === 0);
    }

    // ---- TF-2651 : la garde lit la cible de l'outil ----------------------------------------------
    {
      const d = depot(tmp);
      const dehors = mkdtempSync(join(tmp, "dehors-"));
      const fichierDehors = join(dehors, "notes.txt");
      // Un autre agent dépose un ticket neuf, pas encore commité.
      ecrire(join(d.racine, "tickets/a-faire/T-9999-0101-002.md"), CORPS_TICKET("T-9999-0101-002"));
      const r1 = garde({ queueDir: d.racine, cible: fichierDehors });
      ok("TF-2651 : une écriture hors dépôt passe quand un autre agent laisse un ticket non commité", r1.code === 0, r1.err);
      const r2 = garde({ queueDir: d.racine, cible: join(d.racine, "livrable-existant.txt") });
      ok("TF-2651 : la même écriture dans le dépôt reste refusée", r2.code === 2, r2.err);
      const r3 = garde({ queueDir: d.racine, outil: "NotebookEdit", cle: "notebook_path", cible: join(dehors, "n.ipynb") });
      ok("TF-2651 : une écriture hors dépôt par NotebookEdit (notebook_path) passe aussi", r3.code === 0, r3.err);
      git(d.racine, "mv", TICKET_SUIVI, TICKET_SUIVI.replace("a-faire", "en-cours"));
      const r4 = garde({ queueDir: d.racine, cible: fichierDehors });
      ok("TF-2651 : un claim non commité ne retient pas non plus une écriture hors dépôt", r4.code === 0, r4.err);
    }
    {
      // Disposition de l'installateur : la file est un sous-dossier d'un projet.
      const d = depot(tmp, "queue");
      const dehors = mkdtempSync(join(tmp, "dehors-"));
      ecrire(join(d.file, "tickets/a-faire/T-9999-0101-002.md"), CORPS_TICKET("T-9999-0101-002"));
      const dansProjet = join(d.racine, "livrable-existant.txt");
      const r1 = garde({ queueDir: d.file, cible: join(dehors, "notes.txt") });
      ok("TF-2651 : file en sous-dossier, une écriture hors du projet passe", r1.code === 0, r1.err);
      const r2 = garde({ queueDir: d.file, cible: dansProjet });
      ok("TF-2651 : file en sous-dossier, un livrable du projet reste refusé", r2.code === 2, r2.err);
    }

    // ---- TF-2647 : l'auteur corrige son ticket pas encore commité --------------------------------
    {
      const d = depot(tmp);
      const neuf = join(d.racine, "tickets/a-faire/T-9999-0101-003.md");
      ecrire(neuf, CORPS_TICKET("T-9999-0101-003"));
      const r1 = garde({ queueDir: d.racine, cible: neuf });
      ok("TF-2647 : l'auteur corrige son ticket non commité, sans le supprimer", r1.code === 0, r1.err);
      const r2 = garde({ queueDir: d.racine, cible: join(d.racine, "tickets/a-faire/T-9999-0101-004.md") });
      ok("TF-2647 : créer un ticket neuf passe même quand un autre ticket neuf traîne non commité", r2.code === 0, r2.err);
      const r3 = garde({ queueDir: d.racine, cible: join(d.racine, "livrable-existant.txt") });
      ok("TF-2647 : le ticket non commité ne lève pas la garde des livrables du dépôt", r3.code === 2, r3.err);
      const r4 = garde({ queueDir: d.racine, cible: join(d.racine, TICKET_SUIVI) });
      ok("TF-2647 : un ticket que git connaît reste gardé, même avec un ticket neuf à côté", r4.code === 2 && /non réclamé/.test(r4.err), r4.err);
      git(d.racine, "add", "--", "tickets/a-faire/T-9999-0101-003.md");
      const r5 = garde({ queueDir: d.racine, cible: neuf });
      ok("TF-2647 : un ticket entré à l'index (git add) est connu de git, donc gardé", r5.code === 2 && /non réclamé/.test(r5.err), r5.err);
    }
    {
      // Disposition de l'installateur : le ticket neuf vit sous queue/.
      const d = depot(tmp, "queue");
      const neuf = join(d.file, "tickets/a-faire/T-9999-0101-003.md");
      ecrire(neuf, CORPS_TICKET("T-9999-0101-003"));
      const r1 = garde({ queueDir: d.file, cible: neuf });
      ok("TF-2647 : file en sous-dossier, l'auteur corrige son ticket non commité", r1.code === 0, r1.err);
      const r2 = garde({ queueDir: d.file, cible: join(d.file, TICKET_SUIVI) });
      ok("TF-2647 : file en sous-dossier, un ticket suivi reste gardé", r2.code === 2, r2.err);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(ko ? `${ko} cas en échec sur ${total}` : `${total} cas tenus`);
  process.exit(ko ? 1 : 0);
}

recette();
