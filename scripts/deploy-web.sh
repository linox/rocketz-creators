#!/usr/bin/env python3
"""Envia rocktz-web/dist-cpanel para o FTP creatorsrocketz, incluindo .htaccess.

O Pro Deployer usa vscode.workspace.findFiles, que ignora arquivos ocultos —
o .htaccess nunca sobe por essa via e o Apache devolve 404 nas rotas dinâmicas.
"""

from __future__ import annotations

import json
import sys
from ftplib import FTP, error_perm
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LOCAL = REPO / "rocktz-web" / "dist-cpanel"
CONFIG = REPO / ".vscode" / "pro-deployer.json"
SKIP = {"INSTRUCOES-CPANEL.txt"}


def load_target() -> dict:
    cfg = json.loads(CONFIG.read_text())
    target = next((t for t in cfg["targets"] if t["name"] == "creatorsrocketz"), None)
    if not target:
        raise SystemExit("Target creatorsrocketz não encontrado em .vscode/pro-deployer.json")
    return target


def ensure_cwd(ftp: FTP, path: str) -> None:
    ftp.cwd("/")
    for part in path.strip("/").split("/"):
        if not part:
            continue
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def ensure_dir(ftp: FTP, remote_dir: str, cache: set[str]) -> None:
    if remote_dir in cache or remote_dir in {"", "."}:
        return
    parent = str(Path(remote_dir).parent).replace("\\", "/")
    if parent not in {".", "/"}:
        ensure_dir(ftp, parent, cache)
    try:
        ftp.mkd(remote_dir)
    except error_perm:
        pass
    cache.add(remote_dir)


def iter_files(root: Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.name in SKIP:
            continue
        yield path


def delete_tree(ftp: FTP, remote_dir: str) -> None:
    try:
        ftp.cwd(remote_dir)
    except error_perm:
        return
    names: list[str] = []
    ftp.retrlines("NLST", names.append)
    for name in names:
        base = name.rsplit("/", 1)[-1]
        if base in {".", ".."}:
            continue
        try:
            ftp.delete(base)
        except error_perm:
            delete_tree(ftp, base)
            try:
                ftp.rmd(base)
            except error_perm:
                pass
    ftp.cwd("..")
    try:
        ftp.rmd(remote_dir if "/" not in remote_dir.strip("/") else remote_dir.rsplit("/", 1)[-1])
    except error_perm:
        pass


def main() -> None:
    if not LOCAL.is_dir() or not (LOCAL / "index.html").is_file():
        raise SystemExit("dist-cpanel não encontrado. Rode ./scripts/build-web.sh primeiro.")
    if not (LOCAL / ".htaccess").is_file():
        raise SystemExit("dist-cpanel/.htaccess ausente. Rode o build de novo.")

    target = load_target()
    remote_root = target.get("dir") or "/public_html"

    ftp = FTP()
    ftp.connect(target["host"], int(target.get("port") or 21), timeout=60)
    ftp.login(target["user"], target["password"])
    ftp.set_pasv(True)
    ftp.encoding = "utf-8"
    ensure_cwd(ftp, remote_root)
    ftp.cwd(remote_root)

    print(f"FTP {target['user']}@{target['host']} → {remote_root}")

    for junk in ("dist-cpanel", "rocktz-web-cpanel.zip", "INSTRUCOES-CPANEL.txt"):
        try:
            ftp.delete(junk)
            print(f"  removeu {junk}")
        except error_perm:
            if junk == "dist-cpanel":
                print("  removendo pasta dist-cpanel aninhada…")
                delete_tree(ftp, junk)

    dirs: set[str] = set()
    uploaded = 0
    for path in iter_files(LOCAL):
        rel = path.relative_to(LOCAL).as_posix()
        parent = str(Path(rel).parent).replace("\\", "/")
        if parent not in {".", ""}:
            ensure_dir(ftp, parent, dirs)
        with path.open("rb") as fh:
            ftp.storbinary(f"STOR {rel}", fh)
        uploaded += 1
        if path.name == ".htaccess" or uploaded % 50 == 0:
            print(f"  {uploaded} arquivos… ({rel})")

    size = ftp.size(".htaccess") if hasattr(ftp, "size") else None
    print(f"Enviados {uploaded} arquivos.")
    if not size:
        lines: list[str] = []
        ftp.retrlines("LIST -a", lines.append)
        ht = next((l for l in lines if l.endswith(" .htaccess")), "")
        print(f"  .htaccess remoto: {ht or 'NÃO ENCONTRADO'}")
        if not ht:
            raise SystemExit("Falha: .htaccess não está no public_html.")
    else:
        print(f"  .htaccess remoto: {size} bytes")
        if size < 50:
            raise SystemExit("Falha: .htaccess remoto ainda está vazio.")

    ftp.quit()
    print("Publicação ok.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
