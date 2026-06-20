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


def _create_setup_app(config_dir: str, server_ref: list | None = None):
    """创建临时 FastAPI 应用，处理 /api/setup 端点。

    Args:
        config_dir: 配置目录路径。
        server_ref: 可变列表，用于延迟绑定 uvicorn.Server 实例，
                    以便端点在配置生成后触发服务器关闭。

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
            "avatar_url": "/bot-avatar.png",
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

            # 配置生成成功后，直接关闭 Setup Server，
            # 让 launcher 继续执行 start_bot()
            if server_ref:
                server_ref[0].should_exit = True

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

    @app.post("/api/setup/import")
    async def import_existing_config(request: dict):
        """从已有 Neo-MoFox 实例的 config 目录导入配置。

        委托 desktop.config_parser.parse_configs 读取指定目录下的 TOML 配置，
        返回与向导前端相同格式的配置字典，供前端回填表单。

        Args:
            request: 包含 path 或 config_dir（配置文件目录路径）的请求体。

        Returns:
            JSONResponse: 包含 wizard 格式配置的响应。
        """
        from desktop.config_parser import parse_configs

        cfg_dir = request.get("path") or request.get("config_dir", "")
        if not cfg_dir:
            return JSONResponse(
                content={"status": "error", "message": "未提供 path 或 config_dir"},
                status_code=400,
            )

        cfg_path = Path(cfg_dir)
        if not cfg_path.exists():
            return JSONResponse(
                content={"status": "error", "message": f"目录不存在: {cfg_dir}"},
                status_code=400,
            )

        try:
            result = parse_configs(str(cfg_path))
            if result.get("status") == "not_configured":
                return JSONResponse(
                    content={"status": "error", "message": "目录中未找到有效配置文件"},
                    status_code=400,
                )
            # 返回平铺格式，与 router.py 一致
            return JSONResponse(content=result, status_code=200)

        except Exception as e:
            import traceback

            traceback.print_exc()
            return JSONResponse(
                content={"status": "error", "message": f"读取配置失败: {e}"},
                status_code=500,
            )

    # 静态文件：如果前端 SPA 构建产物存在，直接挂载 StaticFiles
    frontend_dist = Path("plugins/coding_agent_webui/dist")
    if frontend_dist.exists():
        from fastapi.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True))
    else:
        # 前端未构建时，根路径返回 404 JSON
        @app.get("/{path:path}")
        async def frontend_not_available(path: str):
            return JSONResponse(
                content={"error": "Frontend not built"},
                status_code=404,
            )

    return app


async def run_setup_server(
    host: str = "127.0.0.1",
    port: int = 8681,
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

    server_ref: list = []
    app = _create_setup_app(config_dir, server_ref)

    config = uvicorn.Config(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)
    server_ref.append(server)  # 绑定 server 实例，供端点触发关闭

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
