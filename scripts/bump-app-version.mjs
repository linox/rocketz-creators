#!/usr/bin/env node
/**
 * Incrementa rocktz-web/package.json.
 * Cada componente vai de 0 a 99: 0.1.99 → 0.2.0, 0.99.99 → 1.0.0, 1.99.99 → 2.0.0.
 * Patch que já passou de 99 (ex.: 0.1.106) cai no próximo minor .0.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CAP = 99;

export function nextVersion(current) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) {
    throw new Error(`Versão inválida: ${current}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  patch += 1;
  if (patch > CAP) {
    minor += 1;
    patch = 0;
  }
  if (minor > CAP) {
    major += 1;
    minor = 0;
    patch = 0;
  }

  return `${major}.${minor}.${patch}`;
}

function main() {
  const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "rocktz-web");
  const pkg = JSON.parse(readFileSync(join(webRoot, "package.json"), "utf8"));
  const next = nextVersion(pkg.version);

  execFileSync("npm", ["version", next, "--no-git-tag-version"], {
    cwd: webRoot,
    stdio: "inherit",
  });

  console.log(next);
}

const invoked = process.argv[1];
if (invoked && realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
