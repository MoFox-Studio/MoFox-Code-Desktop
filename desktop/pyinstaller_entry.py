"""PyInstaller 入口 — 启动 MoFox Code 后端。"""
import sys
import os
from pathlib import Path

# 修复 PyInstaller 打包后 Windows 控制台中文乱码
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 设置桌面模式环境变量
os.environ["MOFOX_ACCEPT_STARTUP_AGREEMENTS"] = "1"
os.environ["MOFOX_CODE_DESKTOP"] = "1"

if getattr(sys, 'frozen', False):
    # 生产模式：exe 所在目录为应用安装目录（只读），用户数据放 %LOCALAPPDATA%
    _base = Path(getattr(sys, '_MEIPASS', os.path.dirname(sys.executable)))
    _app_dir = Path(os.path.dirname(sys.executable))  # mofox-backend/ 目录

    user_data = Path(os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))) / 'MoFox Code'
    user_data.mkdir(parents=True, exist_ok=True)

    config_dir = str(user_data / 'config')
    log_dir = str(user_data / 'logs')
    plugins_dir = str(_app_dir / 'plugins')

    # CWD 切到用户数据目录，config/logs/data 都在这里
    os.chdir(str(user_data))
else:
    _base = Path(__file__).resolve().parent.parent
    config_dir = "config"
    log_dir = "logs"
    plugins_dir = "plugins"

# 确保项目根在 sys.path 中
if str(_base) not in sys.path:
    sys.path.insert(0, str(_base))

from desktop.launcher import start_bot, _maybe_start_setup_server
import asyncio

if __name__ == "__main__":
    # 首次运行：确保配置存在（触发 Setup API 或向导配置生成）
    _maybe_start_setup_server(None, config_dir)
    asyncio.run(start_bot(config_dir=config_dir, log_dir=log_dir, plugins_dir=plugins_dir))
