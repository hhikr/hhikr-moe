#!/usr/bin/env python3
"""Build an audited website release tarball and bounded base64 transfer chunks."""
from __future__ import annotations

import base64
import fnmatch
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tarfile
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "node_modules" / ".cache" / "main-release"
CHUNK_RAW = 132 * 1024  # base64 is 176 KiB, below the 180 KiB transfer limit.
SECRET_NAME = re.compile(r"(^|[._-])(secrets?|credentials?|private|signing|keystore)([._-]|$)", re.I)
DENY_COMPONENTS = {".git", "node_modules", ".data", "__pycache__", "toolchain", "signing"}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git(*args: str) -> str:
    import subprocess
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def source_files(rel: str) -> list[Path]:
    path = ROOT / Path(*PurePosixPath(rel).parts)
    return [p for p in path.rglob("*") if p.is_file()] if path.is_dir() else [path]


def safe_path(path: Path) -> str:
    resolved = path.resolve(strict=True)
    try:
        relative = resolved.relative_to(ROOT.resolve())
    except ValueError as exc:
        raise RuntimeError(f"source escapes checkout: {path}") from exc
    if not resolved.is_file():
        raise RuntimeError(f"not a regular source file: {path}")
    return PurePosixPath(*relative.parts).as_posix()


def denied(path: str) -> bool:
    parts = PurePosixPath(path).parts
    if any(part.lower() in DENY_COMPONENTS for part in parts):
        return True
    for part in parts:
        lower = part.lower()
        if lower.startswith(".env") or lower.endswith((".pem", ".key", ".jks", ".p12", ".pfx")):
            return True
        # Don't mistake public UI bundles such as credential-key-ui.js for
        # credential files; block only sensitive name components.
        if SECRET_NAME.search(part) and lower.split(".", 1)[0] in {
            "secret", "secrets", "credentials", "credential", "private", "signing", "keystore"
        }:
            return True
    return False


def add_tree(spec: dict, source_prefix: str, archive_prefix: str, target_prefix: str | None = None) -> None:
    target_prefix = target_prefix if target_prefix is not None else archive_prefix
    for file in source_files(source_prefix):
        src = safe_path(file)
        if denied(src):
            continue
        suffix = PurePosixPath(src).relative_to(PurePosixPath(source_prefix)).as_posix()
        arc = PurePosixPath(archive_prefix, suffix).as_posix()
        target = PurePosixPath(target_prefix, suffix).as_posix()
        add_file(spec, src, arc, target)


def add_file(spec: dict, source: str, archive: str, target: str) -> None:
    source = PurePosixPath(source).as_posix()
    archive = PurePosixPath(archive).as_posix()
    target = PurePosixPath(target).as_posix()
    if PurePosixPath(archive).is_absolute() or ".." in PurePosixPath(archive).parts:
        raise RuntimeError(f"unsafe archive member: {archive}")
    path = ROOT.joinpath(*PurePosixPath(source).parts)
    safe_path(path)
    if denied(source) or denied(archive) or denied(target):
        raise RuntimeError(f"allowlist contains excluded/private path: {source} -> {archive}")
    prior = spec["members"].get(archive)
    if prior and prior["source"] != source:
        raise RuntimeError(f"archive path collision: {archive}")
    spec["members"][archive] = {"source": source, "target": target}


def build_specs() -> dict[str, dict]:
    specs = {"website": {"members": {}}}

    # Website deploy root is the application root.
    add_tree(specs["website"], "dist", "dist")
    for rel in ("package.json", "package-lock.json", "scripts/rebuild-search.mjs",
                "scripts/backup.mjs", "src/server/backup.ts", "src/server/config.ts",
                "src/server/migrations.ts", "src/server/system.ts",
                "src/server/db.ts", "src/server/search.ts"):
        add_file(specs["website"], rel, rel, rel)
    # rebuild-search.mjs and backup.mjs import posts/render/media/projects and the
    # markdown plugins; ship the same source folders as tools/deploy/README.md.
    for rel in ("src/server", "src/markdown", "src/plugins"):
        add_tree(specs["website"], rel, rel)

    return specs


def make_archive(name: str, spec: dict) -> dict:
    archive = OUT / f"{name}.tar.gz"
    entries = []
    with tarfile.open(archive, "w:gz", format=tarfile.PAX_FORMAT) as tf:
        for member, mapping in sorted(spec["members"].items()):
            if denied(member) or "\\" in member or member.startswith("/"):
                raise RuntimeError(f"forbidden tar entry: {member}")
            src_path = ROOT.joinpath(*PurePosixPath(mapping["source"]).parts)
            source_bytes = src_path.read_bytes()
            info = tarfile.TarInfo(member)
            info.size = len(source_bytes)
            info.mode = 0o755 if os.access(src_path, os.X_OK) else 0o644
            info.mtime = 0
            import io
            tf.addfile(info, io.BytesIO(source_bytes))
            entries.append({
                "archive_path": member,
                "source_repo_path": mapping["source"],
                "target_path": mapping["target"],
                "source_sha256": sha(source_bytes),
                "target_sha256": sha(source_bytes),
                "size_bytes": len(source_bytes),
            })
    data = archive.read_bytes()
    return {"path": archive.relative_to(ROOT).as_posix(), "sha256": sha(data),
            "size_bytes": len(data), "member_count": len(entries), "members": entries}


def inspect_archive(name: str, info: dict) -> None:
    archive = ROOT / info["path"]
    expected = {item["archive_path"]: item for item in info["members"]}
    with tarfile.open(archive, "r:gz") as tf:
        actual = tf.getmembers()
        got = {m.name: m for m in actual}
        if set(got) != set(expected):
            raise RuntimeError(f"{name}: archive inventory differs from allowlist")
        for member, tarinfo in got.items():
            if not tarinfo.isfile() or denied(member):
                raise RuntimeError(f"{name}: forbidden archive item: {member}")
            content = tf.extractfile(tarinfo).read()
            item = expected[member]
            if len(content) != item["size_bytes"] or sha(content) != item["source_sha256"]:
                raise RuntimeError(f"{name}: archive hash mismatch: {member}")
    if name == "website":
        required = {"dist", "package.json", "package-lock.json", "scripts/rebuild-search.mjs",
                    "scripts/backup.mjs", "src/server/backup.ts", "src/server/config.ts",
                    "src/server/migrations.ts", "src/server/system.ts",
                    "src/server/db.ts", "src/server/search.ts", "src/server/posts.ts",
                    "src/server/render.ts", "src/markdown", "src/plugins"}
        if not all(any(p == r or p.startswith(r + "/") for p in expected) for r in required):
            raise RuntimeError("website: required bundle entries missing")


def write_chunks(name: str, info: dict) -> dict:
    data = (ROOT / info["path"]).read_bytes()
    folder = OUT / "transfer-chunks" / name
    folder.mkdir(parents=True, exist_ok=True)
    chunks = [data[i:i + CHUNK_RAW] for i in range(0, len(data), CHUNK_RAW)]
    result = []
    total = len(chunks)
    for index, raw in enumerate(chunks, 1):
        encoded = base64.b64encode(raw).decode("ascii")
        if len(encoded.encode("ascii")) > 180 * 1024:
            raise RuntimeError("transfer chunk exceeds 180 KiB base64 limit")
        chunk_name = f"{name}-{index:05d}-of-{total:05d}.json"
        payload = {"sequence": index, "total": total, "filename": Path(info["path"]).name,
                   "archive_sha256": info["sha256"], "chunk_sha256": sha(raw),
                   "chunk_bytes": len(raw), "data_base64": encoded}
        target = folder / chunk_name
        target.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        result.append({"sequence": index, "path": target.relative_to(ROOT).as_posix(),
                       "sha256": sha(target.read_bytes()), "base64_chars": len(encoded),
                       "json_size_bytes": target.stat().st_size})
    reconstructed = b"".join(
        base64.b64decode(json.loads((ROOT / item["path"]).read_text(encoding="utf-8"))["data_base64"], validate=True)
        for item in result
    )
    if reconstructed != data or sha(reconstructed) != info["sha256"]:
        raise RuntimeError(f"{name}: transfer chunks do not reconstruct the archive")
    return {"chunk_count": total, "max_base64_chars": max((c["base64_chars"] for c in result), default=0),
            "chunks": result}


def main() -> None:
    if Path(git("rev-parse", "--show-toplevel")).resolve() != ROOT.resolve():
        raise RuntimeError("checkout root mismatch")
    if git("status", "--porcelain=v1", "--untracked-files=all"):
        # Build outputs and this utility are ignored; any surfaced path is a source edit.
        raise RuntimeError("working tree is no longer clean after builds")
    if git("branch", "--show-current") != "main":
        raise RuntimeError("release packages are built from main only")

    specs = build_specs()
    bundles = {}
    for name, spec in specs.items():
        bundles[name] = make_archive(name, spec)
        inspect_archive(name, bundles[name])
        bundles[name]["transfer"] = write_chunks(name, bundles[name])

    manifest = {
        "format": "main-release-transfer-manifest-v1",
        "git_commit": git("rev-parse", "HEAD"),
        "branch": git("branch", "--show-current"),
        "build_commands": [
            {"command": "npm.cmd run build", "result": "run before packaging; dist/ is taken as built"},
        ],
        "policy": {"explicit_allowlists": True, "portable_posix_archive_names": True,
                    "rejected_outside_checkout": True,
                    "excluded": [".git", "node_modules", ".data", "configuration values", "private rules",
                                 "secrets", "signing material", "tools/deploy scripts"],
                    "staging_only_no_upload_or_production_changes": True},
        "bundles": bundles,
    }
    manifest_path = OUT / "transfer-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    manifest_hash = sha(manifest_path.read_bytes())
    summary = [
        "# Main release staging result", "", f"- Git commit: `{manifest['git_commit']}`",
        "- Build: `npm run build` output in dist/.",
        "- Stage: ignored project cache only; no network upload or production path changes.",
        "- Utility: `scripts/package-main-release.py`",
        "- Transfer manifest: `node_modules/.cache/main-release/transfer-manifest.json`",
        f"- Transfer manifest SHA-256: `{manifest_hash}`", "",
        "## Bundles", "",
        "| Bundle | Archive | Size | SHA-256 | Members | Chunks | Max base64 chars |",
        "|---|---|---:|---|---:|---:|---:|",
    ]
    for name, item in bundles.items():
        summary.append(f"| {name} | `{item['path']}` | {item['size_bytes']} bytes | `{item['sha256']}` | {item['member_count']} | {item['transfer']['chunk_count']} | {item['transfer']['max_base64_chars']} |")
    summary += ["", "Archive inventory and member hashes were verified after creation. Chunk JSON files contain base64 payloads and are listed in the transfer manifest.", ""]
    (OUT / "packaging-report.md").write_text("\n".join(summary), encoding="utf-8")
    print(json.dumps({"manifest": manifest_path.relative_to(ROOT).as_posix(),
                      "result": "node_modules/.cache/main-release/packaging-report.md",
                      "manifest_sha256": manifest_hash,
                      "bundles": {n: {"path": b["path"], "sha256": b["sha256"],
                                      "size_bytes": b["size_bytes"], "member_count": b["member_count"],
                                      "chunk_count": b["transfer"]["chunk_count"],
                                      "max_base64_chars": b["transfer"]["max_base64_chars"]}
                                  for n, b in bundles.items()}}, indent=2))


if __name__ == "__main__":
    main()
