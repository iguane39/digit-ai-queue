#!/usr/bin/env node
/**
 * installer-instance.mjs — pose une instance de la file dans un projet, et dit si elle a dérivé.
 *
 * POURQUOI. Le protocole (`protocole/`) est générique ; une instance vit DANS le projet où
 * travaillent les agents, pour que « claim = commit = lock » se joue dans le dépôt qui porte
 * aussi les livrables. Les agents y trouvent le protocole sans sortir de leur espace de travail
 * (principe 5 : tout est inliné ou pointé vers un fichier de la file). La copie du protocole est
 * donc voulue, et sa dérive se mesure : `--verifier` compare l'instance à la source.
 *
 * Usage :
 *   node scripts/installer-instance.mjs <projet> [--dossier queue]   pose ou met à niveau
 *   node scripts/installer-instance.mjs <projet> --verifier           exit 0 conforme, 1 dérive
 *   node scripts/installer-instance.mjs --self-test
 *
 * Ce qui est posé dans <projet>/<dossier>/ :
 *   protocole/            copie conforme de la source (écrasée à chaque installation)
 *   tickets/{a-faire,en-cours,attente-input,termine}/, recus/   (créés s'ils manquent)
 *   local/config.env, local/routage.md, local/guard.sh            (créés s'ils manquent, jamais écrasés)
 *   .gitattributes        (scripts shell en LF, sinon bash casse sur un poste en CRLF)
 *   PROTOCOLE.json        source et commit de la copie
 * Rien n'est écrit hors de <projet>/<dossier>/ : AGENTS.md, CLAUDE.md et le câblage du hook
 * restent des gestes du projet, parce qu'ils portent ses règles propres.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ETATS = ["a-faire", "en-cours", "attente-input", "termine"];

function fichiers(racine) {
  const out = [];
  const marcher = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) marcher(p); else out.push(relative(racine, p).replace(/\\/g, "/"));
    }
  };
  if (existsSync(racine)) marcher(racine);
  return out.sort();
}

// Comparaison à fins de ligne normalisées : un poste en autocrlf ne doit pas lire une dérive.
const lire = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function commitSource(source) {
  const r = spawnSync("git", ["-C", source, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  const sale = spawnSync("git", ["-C", source, "status", "--porcelain", "--", "protocole"], { encoding: "utf8" });
  const sha = (r.stdout || "").trim() || "inconnu";
  return (sale.stdout || "").trim() ? `${sha}+modifs-non-enregistrees` : sha;
}

const CONFIG = `# config.env — paramètres de CETTE instance de la file.
# Seule source des noms concrets d'agents. Les variables sont exportées pour
# rester visibles du validateur : \`source local/config.env\`.
export QUEUE_ASSIGNEES="claude codex humain"
export QUEUE_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
# Profondeur maximale d'une chaîne de tickets créés par des agents (champ parent).
# Au-delà, le ticket est assigné à « humain ».
export MAX_PROFONDEUR=3
`;

const ROUTAGE = `# Routage de cette instance

Qui traite quel travail. Les valeurs du champ \`assigne\` sont celles de
\`QUEUE_ASSIGNEES\` dans [config.env](config.env).

| Type de travail | Assigné |
|---|---|
| (à remplir par le projet) | \`claude\`, \`codex\` ou \`humain\` |
| Tout ce qui sort vers un tiers | \`humain\` |
`;

const GUARD = `#!/usr/bin/env bash
# guard.sh — lance la garde de claim du protocole sur CETTE instance.
# Câblage : hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit) de Claude Code.
QUEUE_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
export QUEUE_DIR
exec bash "$QUEUE_DIR/protocole/scripts/guard-claim.sh"
`;

export function installer(projet, dossier = "queue", source = SOURCE) {
  const inst = join(projet, dossier);
  const proto = join(inst, "protocole");
  rmSync(proto, { recursive: true, force: true });
  cpSync(join(source, "protocole"), proto, { recursive: true });
  for (const e of ETATS) mkdirSync(join(inst, "tickets", e), { recursive: true });
  mkdirSync(join(inst, "recus"), { recursive: true });
  for (const d of [...ETATS.map((e) => join("tickets", e)), "recus"]) {
    const g = join(inst, d, ".gitkeep");
    if (!existsSync(g)) writeFileSync(g, "");
  }
  mkdirSync(join(inst, "local"), { recursive: true });
  const poses = [];
  for (const [nom, contenu] of [["config.env", CONFIG], ["routage.md", ROUTAGE], ["guard.sh", GUARD]]) {
    const p = join(inst, "local", nom);
    if (!existsSync(p)) { writeFileSync(p, contenu); poses.push(`local/${nom}`); }
  }
  writeFileSync(join(inst, ".gitattributes"), "*.sh text eol=lf\n*.env text eol=lf\n");
  const manifeste = {
    schema: "digit-ai-queue/instance@1",
    source: "digit-ai-queue",
    commit: commitSource(source),
    installe_le: new Date().toISOString(),
    protocole: fichiers(proto),
  };
  writeFileSync(join(inst, "PROTOCOLE.json"), JSON.stringify(manifeste, null, 2) + "\n");
  return { inst, poses, manifeste };
}

export function verifier(projet, dossier = "queue", source = SOURCE) {
  const inst = join(projet, dossier);
  const ecarts = [];
  if (!existsSync(inst)) return { verdict: "FAIL", ecarts: [`${dossier}/ absent`] };
  for (const e of ETATS) if (!existsSync(join(inst, "tickets", e))) ecarts.push(`tickets/${e}/ absent`);
  if (!existsSync(join(inst, "recus"))) ecarts.push("recus/ absent");
  for (const n of ["config.env", "guard.sh"]) if (!existsSync(join(inst, "local", n))) ecarts.push(`local/${n} absent`);
  const src = fichiers(join(source, "protocole"));
  const cop = fichiers(join(inst, "protocole"));
  for (const f of src) {
    const c = join(inst, "protocole", f);
    if (!existsSync(c)) ecarts.push(`protocole/${f} absent de l'instance`);
    else if (lire(c) !== lire(join(source, "protocole", f))) ecarts.push(`protocole/${f} diffère de la source`);
  }
  for (const f of cop) if (!src.includes(f)) ecarts.push(`protocole/${f} en trop (absent de la source)`);
  return { verdict: ecarts.length ? "FAIL" : "PASS", ecarts };
}

function selfTest() {
  let ko = 0;
  const ok = (nom, cond) => { console.log(`${cond ? "ok  " : "KO  "} ${nom}`); if (!cond) ko++; };
  const t = mkdtempSync(join(tmpdir(), "queue-inst-"));
  try {
    installer(t);
    ok("une instance neuve est conforme", verifier(t).verdict === "PASS");
    ok("les 4 états et recus/ existent", ETATS.every((e) => existsSync(join(t, "queue", "tickets", e))) && existsSync(join(t, "queue", "recus")));
    const readme = join(t, "queue", "protocole", "README.md");
    writeFileSync(readme, lire(readme) + "\nmodif locale\n");
    const v1 = verifier(t);
    ok("une copie modifiée est une dérive", v1.verdict === "FAIL" && v1.ecarts.some((e) => e.includes("README.md diffère")));
    writeFileSync(readme, lire(join(SOURCE, "protocole", "README.md")).replace(/\n/g, "\r\n"));
    ok("des fins de ligne CRLF ne sont pas une dérive", verifier(t).verdict === "PASS");
    writeFileSync(join(t, "queue", "protocole", "intrus.md"), "x");
    ok("un fichier en trop est une dérive", verifier(t).ecarts.some((e) => e.includes("intrus.md en trop")));
    const routage = join(t, "queue", "local", "routage.md");
    writeFileSync(routage, "routage propre au projet\n");
    const r = installer(t);
    ok("la réinstallation remet la copie à niveau", verifier(t).verdict === "PASS");
    ok("la réinstallation n'écrase pas la couche locale", lire(routage) === "routage propre au projet\n" && r.poses.length === 0);
    rmSync(join(t, "queue", "tickets", "attente-input"), { recursive: true });
    ok("un état manquant est un défaut", verifier(t).ecarts.includes("tickets/attente-input/ absent"));
    ok("un projet sans instance échoue", verifier(join(t, "rien")).verdict === "FAIL");
  } finally { rmSync(t, { recursive: true, force: true }); }
  console.log(ko ? `${ko} cas en échec` : "9 cas tenus");
  process.exit(ko ? 1 : 0);
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) selfTest();
else {
  const projet = args.find((a) => !a.startsWith("--"));
  const i = args.indexOf("--dossier");
  const dossier = i >= 0 ? args[i + 1] : "queue";
  if (!projet || (i >= 0 && !dossier)) {
    console.error("usage : node scripts/installer-instance.mjs <projet> [--dossier queue] [--verifier] | --self-test");
    process.exit(2);
  }
  if (args.includes("--verifier")) {
    const r = verifier(resolve(projet), dossier);
    console.log(`${r.verdict} — instance ${join(resolve(projet), dossier)}`);
    for (const e of r.ecarts) console.log(`  - ${e}`);
    process.exit(r.verdict === "PASS" ? 0 : 1);
  }
  const r = installer(resolve(projet), dossier);
  console.log(`instance posée : ${r.inst} (protocole ${r.manifeste.commit}, ${r.manifeste.protocole.length} fichiers)`);
  if (r.poses.length) console.log(`couche locale créée : ${r.poses.join(", ")} — à adapter au projet`);
  const v = verifier(resolve(projet), dossier);
  console.log(`vérification : ${v.verdict}`);
  process.exit(v.verdict === "PASS" ? 0 : 1);
}
