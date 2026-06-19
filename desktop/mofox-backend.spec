# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for MoFox Code Desktop backend."""

import sys
import os
from pathlib import Path

# 使用当前工作目录作为项目根（从项目根目录运行 PyInstaller）
_project_root = Path(os.getcwd())
_plugins = _project_root / "plugins"
_src = _project_root / "src"

# 收集需要打包的数据目录
# 注意：打包前应确保源码目录中不含 .git / __pycache__ / dist 等垃圾
added_datas = []


def _collect_plugin_files(src_dir: Path, dest_dir: str) -> list[tuple[str, str]]:
    """收集插件目录中的必要文件，排除垃圾文件。

    排除规则：
    - 隐藏目录/文件：所有以 . 开头的目录或文件（如 .git, .agents, .gitignore）
    - 目录：__pycache__, node_modules, .pytest_cache, .ruff_cache, htmlcov, build
    - 扩展名：.pyc, .pyo, .pyd
    - coding_agent_webui/frontend/ 下只包含 dist/ 目录
    """
    EXCLUDE_DIRS = {"__pycache__", "node_modules", ".pytest_cache", ".ruff_cache", "htmlcov", "build"}
    EXCLUDE_EXTS = {".pyc", ".pyo", ".pyd"}
    result: list[tuple[str, str]] = []
    for item in src_dir.rglob("*"):
        if not item.is_file():
            continue
        rel = item.relative_to(src_dir)
        parts = rel.parts
        if item.name.startswith("."):
            continue
        if any(part.startswith(".") for part in parts[:-1]):
            continue
        # 跳过排除目录下的文件
        if any(part in EXCLUDE_DIRS for part in parts):
            continue
        if item.suffix in EXCLUDE_EXTS:
            continue
        # coding_agent_webui/frontend/ 下只包含 dist/ 目录
        if parts and parts[0] == "frontend" and len(parts) > 1 and parts[1] != "dist":
            continue
        # PyInstaller datas 的第二个字段是“目标目录”，不能包含文件名，
        # 否则会把文件打成同名目录再把原文件放进去。
        rel_parent = rel.parent.as_posix()
        target_dir = dest_dir if rel_parent == "." else f"{dest_dir}/{rel_parent}"
        result.append((str(item), target_dir))
    return result


# plugins 目录 — 过滤垃圾文件
added_datas.extend(_collect_plugin_files(_plugins / "coding_agent", "plugins/coding_agent"))
added_datas.extend(_collect_plugin_files(_plugins / "coding_agent_webui", "plugins/coding_agent_webui"))

# tiktoken 编码数据文件（cl100k_base 等）
import tiktoken_ext  # type: ignore
_tiktoken_ext_dir = Path(tiktoken_ext.__path__[0])  # type: ignore
added_datas.append((str(_tiktoken_ext_dir), "tiktoken_ext"))

a = Analysis(
    [str(_project_root / "desktop" / "pyinstaller_entry.py")],
    pathex=[str(_project_root)],
    binaries=[],
    datas=added_datas,
    hiddenimports=[
        # ChromaDB 依赖
        "chromadb",
        "chromadb.config",
        "chromadb.db",
        "chromadb.api",
        # SQLAlchemy 方言
        "sqlalchemy.dialects.sqlite",
        "sqlalchemy.dialects.sqlite.aiosqlite",
        "aiosqlite",  # SQLAlchemy async SQLite 驱动，动态加载需显式声明
        # tiktoken 编码（cl100k_base）
        "tiktoken_ext",
        "tiktoken_ext.openai_public",
        # 可能遗漏的动态导入
        "websockets",
        "uvicorn",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        # FastAPI
        "fastapi",
        "fastapi.middleware",
        "fastapi.middleware.cors",
        "fastapi.staticfiles",
        # Rich
        "rich",
        "rich.console",
        "rich.panel",
        "rich.progress",
        "rich.table",
        # TOML
        "tomllib",
        # 可能需要的包
        "aiofiles",
        "pybase64",
        "mofox_wire",
        # Pydantic
        "pydantic",
        "pydantic.deprecated",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy.testing",
        "scipy",
        "pandas",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="mofox-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="mofox-backend",
)
