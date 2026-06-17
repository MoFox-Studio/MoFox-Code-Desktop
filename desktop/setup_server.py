"""Setup API 服务器 — 首次启动时接收来自前端的向导配置。

当 config/ 目录不存在时，后端启动一个临时 HTTP 服务器，
等待前端通过 POST /api/setup 提交向导配置 JSON。
收到配置后生成 TOML 文件并返回成功，然后退出让 launcher 重启。
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# 确保项目根目录在 sys.path 中
_proj_root = Path(__file__).resolve().parent.parent
if str(_proj_root) not in sys.path:
    sys.path.insert(0, str(_proj_root))


def _create_setup_app(config_dir: str):
    """创建临时 FastAPI 应用，处理 /api/setup 端点。

    Args:
        config_dir: 配置目录路径。

    Returns:
        FastAPI: 配置好的应用实例。
    """
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    app = FastAPI(title="MoFox Code Setup", docs_url=None, redoc_url=None)

    # CORS — 允许 Tauri webview 和浏览器访问
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/setup/status")
    async def get_setup_status():
        """返回 Setup API 状态，前端用于检测是否需要向导。"""
        config_core = Path(config_dir) / "core.toml"
        return {
            "status": "awaiting_config" if not config_core.exists() else "configured",
            "message": "等待向导配置" if not config_core.exists() else "已配置",
        }

    @app.get("/api/config")
    async def get_config():
        """返回 UI 配置，包括 desktop_mode 检测。"""
        return {
            "title": "MoFox Code",
            "default_theme": "light",
            "avatar_url": "/logo.png",
            "desktop_mode": os.environ.get("MOFOX_CODE_DESKTOP") == "1",
        }

    @app.post("/api/setup")
    async def submit_setup(config: dict):
        """接收向导配置 JSON，生成 TOML 文件。

        Args:
            config: 向导配置字典。

        Returns:
            JSONResponse: 包含状态和生成的文件列表。
        """
        try:
            from desktop.config_generator import generate_configs

            generated = generate_configs(config, config_dir)

            return JSONResponse(
                content={
                    "status": "ok",
                    "message": "配置已生成，后端即将重启",
                    "files": {k: str(v) for k, v in generated.items()},
                },
                status_code=200,
            )

        except Exception as e:
            import traceback

            traceback.print_exc()
            return JSONResponse(
                content={
                    "status": "error",
                    "message": f"配置生成失败: {e}",
                },
                status_code=500,
            )

    # 静态文件回退：如果前端 SPA 存在则 serve，否则返回 404
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve 前端 SPA（如果可用）。"""
        frontend_dist = Path("plugins/coding_agent_webui/dist")
        if frontend_dist.exists():
            from fastapi.staticfiles import StaticFiles

            # 懒挂载
            if not any(r.path == "/" for r in app.routes):
                app.mount("/", StaticFiles(directory=str(frontend_dist), html=True))
            from fastapi.responses import FileResponse

            file_path = frontend_dist / path
            if file_path.is_file():
                return FileResponse(str(file_path))
            return FileResponse(str(frontend_dist / "index.html"))
        return JSONResponse(
            content={"error": "Frontend not built"},
            status_code=404,
        )

    return app


async def run_setup_server(
    host: str = "127.0.0.1",
    port: int = 8680,
    config_dir: str = "config",
) -> None:
    """启动临时 Setup API 服务器。

    该函数会阻塞直到收到有效配置或进程被终止。

    Args:
        host: 监听地址。
        port: 监听端口。
        config_dir: 配置目录路径。
    """
    import uvicorn

    app = _create_setup_app(config_dir)

    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)

    print(f"[Setup] Setup API 服务器已启动: http://{host}:{port}")
    print(f"[Setup] POST http://{host}:{port}/api/setup 提交配置")
    print(f"[Setup] GET  http://{host}:{port}/api/setup/status 检查状态")

    try:
        await server.serve()
    except asyncio.CancelledError:
        pass
    finally:
        print("[Setup] Setup API 服务器已关闭。")


if __name__ == "__main__":
    asyncio.run(run_setup_server())
