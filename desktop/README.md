# MoFox Code Desktop

桌面版 MoFox Code 的工具模块。

## 模块说明

- `config_generator.py` — 从向导配置 JSON 生成 TOML 配置文件
- `launcher.py` — Python 后端启动器（sidecar）
- `setup_server.py` — 首次启动时的临时 Setup API 服务器

## 使用方式

```bash
# 1. 生成配置文件
python -c "from desktop.config_generator import generate_configs; generate_configs({...}, 'config')"

# 2. 启动后端
python -m desktop.launcher --wizard-config wizard_config.json
```

## 目录结构

```
desktop/
├── __init__.py
├── config_generator.py    # 配置生成器
├── launcher.py            # 后端启动器
├── setup_server.py        # Setup API 服务器
├── README.md
└── tauri/                 # Tauri 壳（Rust 项目，Phase 2）
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
```
