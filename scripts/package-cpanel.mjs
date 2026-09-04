import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");
const webRoot = join(repoRoot, "rocktz-web");
const exported = join(webRoot, "out");
const htaccess = join(scriptsDir, "cpanel.htaccess");
const out = join(webRoot, "dist-cpanel");

const skipNames = new Set([
  "INSTRUCOES-CPANEL.txt",
]);

if (!existsSync(exported)) {
  console.error("Export estático não encontrado. Rode `./scripts/build-web.sh`.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(exported, out, { recursive: true });

if (existsSync(htaccess)) {
  cpSync(htaccess, join(out, ".htaccess"));
}

const landingSeoSrc = join(scriptsDir, "landing-seo.php");
if (existsSync(landingSeoSrc)) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.creatorz.digital/api";
  writeFileSync(join(out, "landing-seo.php"), readFileSync(landingSeoSrc, "utf8").replaceAll("__API_URL__", apiUrl));
}

function stripJunk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (skipNames.has(name) || name.startsWith("__next.")) {
      rmSync(path, { recursive: true, force: true });
      continue;
    }
    if (statSync(path).isDirectory()) {
      stripJunk(path);
    }
  }
}

stripJunk(out);

console.log("Pacote cPanel (estático) gerado em rocktz-web/dist-cpanel/");
