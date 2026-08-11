import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const [rootArgument, stateArgument] = process.argv.slice(2);
const failures = [];

function fail(message) {
  failures.push(message);
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

if (!rootArgument || !stateArgument) {
  console.error("Usage: verify-containment.mjs <repository-root> <state-root>");
  process.exit(2);
}

const root = fs.realpathSync(rootArgument);
const stateParent = fs.realpathSync(path.dirname(stateArgument));
const stateRoot = path.join(stateParent, path.basename(stateArgument));

if (!isInside(root, stateRoot)) {
  fail(`CLAW3D_HOME sort de la racine: ${stateRoot}`);
}

const marker = path.join(root, ".claw3d-root");
if (fs.readFileSync(marker, "utf8").trim() !== "claw3d.visual-ui.root.v1") {
  fail("marqueur racine invalide");
}

function inspectSymlinks(directory) {
  if (!fs.existsSync(directory)) return;
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (current === root && entry.name === ".git") continue;
      const absolutePath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          const resolved = fs.realpathSync(absolutePath);
          if (!isInside(root, resolved)) {
            fail(`lien symbolique hors racine: ${path.relative(root, absolutePath)} -> ${resolved}`);
          }
        } catch {
          fail(`lien symbolique invalide: ${path.relative(root, absolutePath)}`);
        }
      } else if (entry.isDirectory()) {
        pending.push(absolutePath);
      }
    }
  }
}

inspectSymlinks(root);

const tracked = execFileSync("git", ["-C", root, "ls-files", "-s"], { encoding: "utf8" });
for (const line of tracked.split("\n")) {
  if (!line.startsWith("120000 ")) continue;
  const tab = line.indexOf("\t");
  const relativePath = tab >= 0 ? line.slice(tab + 1) : "";
  const linkPath = path.join(root, relativePath);
  try {
    const resolved = fs.realpathSync(linkPath);
    if (!isInside(root, resolved)) fail(`lien symbolique suivi hors racine: ${relativePath} -> ${resolved}`);
  } catch {
    fail(`lien symbolique suivi invalide: ${relativePath}`);
  }
}

const activeRoots = [
  "apps/claw3d-ui",
  "packages",
  "scripts/install.sh",
  "scripts/start.sh",
  "scripts/stop.sh",
  "scripts/uninstall.sh",
  "scripts/lib/project-root.sh",
];
const sourceExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".sh", ".json"]);

function collectFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    fail(`entrée active sous forme de lien symbolique: ${relativePath}`);
    return [];
  }
  if (stat.isFile()) return [absolutePath];
  if (!stat.isDirectory()) return [];
  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if ([".next", "node_modules", "coverage", "test-results"].includes(entry.name)) return [];
    return collectFiles(path.join(relativePath, entry.name));
  });
}

const riskyWritePatterns = [
  { label: "élévation sudo", pattern: /\bsudo\b/ },
  { label: "installation npm globale", pattern: /\bnpm\s+(?:install|i)\s+(?:[^\n]*\s)?-g\b|\bnpm\s+--global\b/ },
  { label: "service système", pattern: /\b(?:launchctl|systemctl|crontab)\b/ },
  { label: "cible système persistante", pattern: /\b(?:mkdir|cp|mv|rm|install)\b[^\n]*(?:\/Library|\/usr\/local|\/opt(?:\/|\s)|\/var(?:\/|\s)|\/etc(?:\/|\s)|~\/|\$HOME\/)/ },
  { label: "chemin local JARVIS", pattern: /(?:\/Users\/[^\s"']+\/JARVIS|\/home\/[^\s"']+\/JARVIS|\.\.\/JarvisAPI|file:[^\s"']*jarvis)/i },
];

for (const absolutePath of activeRoots.flatMap(collectFiles)) {
  if (!sourceExtensions.has(path.extname(absolutePath))) continue;
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const { label, pattern } of riskyWritePatterns) {
    if (pattern.test(content)) fail(`${label}: ${path.relative(root, absolutePath)}`);
  }
}

const packageFiles = ["package.json", ...fs.readdirSync(path.join(root, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join("packages", entry.name, "package.json")), "apps/claw3d-ui/package.json"];
for (const packageFile of packageFiles) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, packageFile), "utf8"));
  for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
    for (const [name, value] of Object.entries(manifest[group] ?? {})) {
      if (String(value).startsWith("file:") || /jarvis/i.test(name)) {
        if (name !== "@claw3d/adapter-jarvis-readonly") fail(`dépendance externe interdite dans ${packageFile}: ${name}@${value}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Vérification de confinement: ÉCHEC");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Vérification de confinement: OK (${root})`);
console.log(`État projet autorisé: ${stateRoot}`);
console.log("Aucune installation globale, cible système, dépendance JARVIS locale ou lien suivi hors racine détecté dans le produit actif.");
