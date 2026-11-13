#!/usr/bin/env python3
"""Build a LOCAL, gitignored copy of the extension with this deployment's secrets.

Reads dist/extension (placeholders only, committed) and writes
dist/extension-local (real values, never committed).

Usage: python3 scripts/build-local.py
"""
from pathlib import Path
import os
import shutil

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dist" / "extension"
OUT = ROOT / "dist" / "extension-local"

PLACEHOLDERS = {
    "__BRIDGE_AUTH_TOKEN__": "BRIDGE_AUTH_TOKEN",
    "__CLIENT_API_KEY__": "CLIENT_API_KEY",
    "__WORKER_URL__": "WORKER_URL",
    "__MCP_ENDPOINT__": "MCP_ENDPOINT",
    "__WSS_ENDPOINT__": "WSS_ENDPOINT",
    "__OPENAI_ENDPOINT__": "OPENAI_ENDPOINT",
}


def load_env() -> dict:
    values = {}
    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    # process env wins
    for k in PLACEHOLDERS.values():
        if os.environ.get(k):
            values[k] = os.environ[k]
    return values


def main() -> None:
    secrets = load_env()
    missing = [k for k in PLACEHOLDERS.values() if not secrets.get(k)]
    if missing:
        raise SystemExit(f"missing values for: {', '.join(missing)} (fill .env)")

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT)

    replaced = 0
    for path in OUT.rglob("*"):
        if not path.is_file() or path.suffix not in {".js", ".json", ".html"}:
            continue
        text = path.read_text(encoding="utf-8")
        new = text
        for ph, key in PLACEHOLDERS.items():
            if ph in new:
                new = new.replace(ph, secrets[key])
        if new != text:
            path.write_text(new, encoding="utf-8")
            replaced += 1

    leftover = [str(p.relative_to(OUT)) for p in OUT.rglob("*")
                if p.is_file() and p.suffix in {".js", ".json", ".html"}
                and any(ph in p.read_text(encoding="utf-8", errors="ignore") for ph in PLACEHOLDERS)]
    if leftover:
        raise SystemExit(f"placeholders left in: {leftover}")

    print(f"built {OUT} ({replaced} files substituted)")


if __name__ == "__main__":
    main()
