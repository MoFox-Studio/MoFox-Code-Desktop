"""Python 后端启动器 — 桌面版 MoFox Code 的 sidecar 进程。

命令行入口::

    python -m desktop.launcher --wizard-config <path>

工作流程:
1. 读取向导配置 JSON
2. 调用 config_generator 生成 config/ 目录
3. 设置环境变量跳过 EULA
4. 创建 Bot 实例（MINIMAL UI 级别）
5. 启动 Bot（WebSocket :8765 + HTTP :8680）
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# 确保项目根目录在 sys.path 中
_proj_root = Path(__file__).resolve().parent.parent
if str(_proj_root) not in sys.path:
    sys.path.insert(0, str(_proj_root))


async def start_bot(config_dir: str = "config") -> None:
    """启动 Bot 后端。

    Args:
        config_dir: 配置目录路径。
    """
    from src.app.runtime.bot import Bot
    from src.app.runtime.console_ui import UILevel

    # 设置 EULA 跳过环境变量（必须在 import Bot 之前或最早设置）
    os.environ["MOFOX_ACCEPT_STARTUP_AGREEMENTS"] = "1"
    # 标记为桌面版环境，webui 前端据此决定是否显示设置面板等桌面专用功能
    os.environ["MOFOX_CODE_DESKTOP"] = "1"

    config_path = str(Path(config_dir) / "core.toml")

    bot = Bot(
        config_path=config_path,
        plugins_dir="plugins",
        log_dir="logs",
        ui_level=UILevel.MINIMAL,
    )

    await bot.start()


def _maybe_start_setup_server(wizard_config: dict, config_dir: str) -> None:
    """如果 config/ 目录不存在，启动临时 Setup API 服务器。

    收到配置后生成 TOML 并重启自身。

    Args:
        wizard_config: 向导配置字典（如果 --wizard-config 提供，否则为 None）。
        config_dir: 配置目录路径。
    """
    config_core = Path(config_dir) / "core.toml"

    # 如果核心配置文件已存在，跳过 Setup 流程
    if config_core.exists():
        return

    # 如果提供了向导配置 JSON，直接生成配置
    if wizard_config:
        from desktop.config_generator import generate_configs

        print("[Setup] 从向导配置生成 TOML 文件...")
        generate_configs(wizard_config, config_dir)
        print("[Setup] 配置生成完成，启动 Bot...")
        return

    # 否则启动 Setup API 服务器，等待前端提交配置
    print("[Setup] config/ 目录不存在，启动 Setup API 服务器...")
    print("[Setup] 等待前端通过 POST /api/setup 提交配置...")

    from desktop.setup_server import run_setup_server

    try:
        asyncio.get_event_loop().run_until_complete(
            run_setup_server(config_dir=config_dir)
        )
    except KeyboardInterrupt:
        print("\n[Setup] 用户取消设置流程。")
        sys.exit(0)


def main() -> None:
    """CLI 入口。"""
    parser = argparse.ArgumentParser(
        description="MoFox Code Desktop — Python 后端启动器",
    )
    parser.add_argument(
        "--wizard-config",
        type=str,
        default=None,
        help="向导配置 JSON 文件路径（由 Tauri 侧传递）",
    )
    parser.add_argument(
        "--config-dir",
        type=str,
        default="config",
        help="配置目录路径（默认 config）",
    )
    args = parser.parse_args()

    wizard_config = None
    if args.wizard_config:
        wiz_path = Path(args.wizard_config)
        if not wiz_path.exists():
            print(f"[Error] 向导配置文件不存在: {wiz_path}")
            sys.exit(1)
        wizard_config = json.loads(wiz_path.read_text(encoding="utf-8"))

    # 阶段 1: 确保配置文件存在（生成或等待 Setup）
    _maybe_start_setup_server(wizard_config, args.config_dir)

    # 阶段 2: 启动 Bot
    print("[Launcher] 启动 MoFox Code Bot...")
    try:
        asyncio.run(start_bot(args.config_dir))
    except KeyboardInterrupt:
        print("\n[Launcher] 用户中断，正在退出...")


if __name__ == "__main__":
    main()
