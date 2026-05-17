# BiliMediaToolkit

一个功能强大的 Bilibili 视频下载器，支持最高画质下载、番剧、合集、收藏夹批量下载和直播录制。

## 功能特性

- 🎬 支持 8K/4K/1080P60/杜比视界/HDR 最高画质
- 🎞️ 视频编码选择（AV1/HEVC/AVC）
- 🎵 音频质量选择（杜比全景声/Hi-Res无损/320kbps）
- 🎧 仅音频模式（MP3/FLAC/M4A）
- 📺 番剧/电影/纪录片下载（需大会员）
- 📦 合集/收藏夹一键批量下载
- 🔴 直播流 ffmpeg 录制
- 🔐 扫码登录 + 手动 Cookie 双模式
- ⚡ WebSocket 实时下载进度推送
- 🚀 可配置并发下载数（1-8）
- 🔧 ffmpeg 首次运行自动下载
- 💾 SQLite 下载历史记录
- 🌙 暗色毛玻璃 UI 设计

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + WebSocket (ws) |
| 前端 | React + Vite + Tailwind CSS + Zustand |
| 数据库 | SQLite (better-sqlite3) |
| 工具 | ffmpeg（自动下载） |

## 快速开始

### 环境要求

- Node.js >= 18

### 安装步骤

```bash
git clone https://github.com/lrastar/BiliMediaToolkit.git
cd BiliMediaToolkit
npm run install:all
npm run dev
```

### 访问地址

前端：http://localhost:5173

后端 API：http://localhost:3000

## 项目结构

```
BiliMediaToolkit/
├── client/                  # 前端 React 应用
│   ├── src/
│   │   ├── components/      # 公共组件
│   │   ├── pages/           # 页面组件
│   │   ├── stores/          # Zustand 状态管理
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
├── server/                  # 后端 Express 服务
│   ├── lib/                 # 核心库
│   │   ├── auth.js          # 认证逻辑
│   │   ├── bilibili-api.js  # B站 API 封装
│   │   ├── config.js        # 配置管理
│   │   ├── database.js      # SQLite 数据库
│   │   ├── downloader.js    # 下载引擎
│   │   └── ffmpeg.js        # ffmpeg 管理
│   ├── routes/              # API 路由
│   │   ├── auth.js
│   │   ├── download.js
│   │   ├── history.js
│   │   ├── live.js
│   │   ├── settings.js
│   │   └── video.js
│   └── index.js
├── config.json              # 运行时配置
└── package.json
```

## API 接口概览

### 认证 `/api/auth`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/qr/generate` | 生成登录二维码 |
| GET | `/qr/poll` | 轮询扫码状态 |
| POST | `/cookie` | 手动设置 Cookie |
| GET | `/status` | 获取登录状态 |
| DELETE | `/logout` | 退出登录 |

### 视频 `/api/video`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/inspect` | 解析视频信息 |
| POST | `/stream-options` | 获取可用画质/编码 |
| POST | `/download` | 下载单个视频 |
| POST | `/download/batch` | 批量下载 |
| POST | `/download/audio-only` | 仅下载音频 |
| POST | `/bangumi` | 获取番剧信息 |
| POST | `/bangumi/stream` | 获取番剧流地址 |
| POST | `/collection` | 获取合集列表 |
| POST | `/favorite` | 获取收藏夹列表 |

### 下载队列 `/api/download`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/queue` | 获取下载队列 |
| POST | `/:id/pause` | 暂停任务 |
| POST | `/:id/resume` | 恢复任务 |
| DELETE | `/:id` | 取消任务 |

### 直播 `/api/live`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/info` | 获取直播间信息 |
| POST | `/start` | 开始录制 |
| POST | `/:id/stop` | 停止录制 |
| GET | `/status` | 获取录制状态 |

### 设置 `/api/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取当前配置 |
| PUT | `/` | 更新配置 |
| POST | `/ffmpeg/download` | 下载 ffmpeg |

### 历史记录 `/api/history`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取下载历史（分页） |
| DELETE | `/:id` | 删除单条记录 |
| DELETE | `/` | 清空所有记录 |

### WebSocket

| 路径 | 说明 |
|------|------|
| `ws://localhost:3000/ws` | 实时下载进度推送 |

## 配置说明

项目根目录下的 `config.json` 文件（首次运行自动生成）：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `cookie` | string | `""` | B站登录 Cookie |
| `downloadPath` | string | `"./downloads"` | 下载文件保存路径 |
| `concurrency` | number | `3` | 并发下载数（1-8） |
| `audioFormat` | string | `"mp3"` | 纯音频下载格式（mp3/flac/m4a） |

## 注意事项

> ⚠️ 本项目仅供学习研究使用，请遵守以下约定：

- 请勿用于商业用途
- 下载内容请在 24 小时内删除
- 尊重创作者版权，支持正版

## License

[GNU General Public License v3.0](LICENSE)
