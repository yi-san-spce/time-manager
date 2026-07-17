# 时间管理器

> 一款面向 Windows 的 AI 辅助桌面时间管理工具：把日程规划、任务专注、实际时间追踪与复盘报告放进同一个闭环。

[![Windows CI](https://github.com/yi-san-spce/time-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/yi-san-spce/time-manager/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white)](#下载与安装)
[![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-4CAF50.svg)](LICENSE)

## 它解决什么问题？

很多时间管理工具只能帮你计划，或者只能帮你统计。这个项目希望把两者连起来：先安排要做的事，开始专注时关联任务或日程，应用在后台记录真实投入，最后用统计与报告复盘计划和现实之间的差距。

```text
日程规划 → 任务拆分 → 番茄专注 → 自动追踪 → 统计分析 → AI 辅助复盘
```

## 核心功能

| 场景 | 能力 |
| --- | --- |
| 规划 | 单次/重复日程、提醒、分类与优先级；任务、子任务、标签和日程关联。 |
| 执行 | 番茄钟可关联日程或任务；悬浮窗可直接选择目标并开始专注。 |
| 记录 | Windows 活动窗口自动追踪；支持手动补录、关联任务/日程、合并和删除记录。 |
| 查看 | 应用总览、单日横向时间线、日期切换、拖拽平移、分钟级缩放，以及短记录和重叠记录的可读布局。 |
| 复盘 | 日/周/月及自定义区间统计，分类分布、Top 应用/网站/窗口标题；日报、周报和按需报告可导出 Markdown 或 PDF。 |
| AI | 可显式配置 Claude 或 OpenAI，用于活动总结、报告总结和带确认步骤的对话式操作。未配置 AI 时，日程、任务、追踪和统计仍可独立使用。 |
| 桌面体验 | 悬浮 AI 助手、悬浮日程/任务/番茄钟小窗；随心记与任务详情跨窗口同步。 |

## 下载与安装

前往 [GitHub Releases](https://github.com/yi-san-spce/time-manager/releases/latest) 下载 `TimeManager-*-win-x64.zip`。

当前首版提供 **Windows x64 免安装应用包**：

1. 解压下载的 ZIP，运行其中的 `TimeManager.exe`。
2. 首次启动后，数据会在 Electron 的用户数据目录中自动初始化为本地 SQLite 数据库。
3. 应用默认使用本地数据；仅当你主动在设置页启用 AI 供应商时，才会发生对应的外部 AI 请求。

> 应用包尚未进行商业代码签名，因此 Windows 可能提示“未知发布者”。请仅从本仓库的 Release 页面获取应用包；正式对外分发前建议配置代码签名证书。

## 本地开发

### 环境要求

- Windows 10/11 x64（活动窗口追踪依赖 Windows 能力）
- Node.js `20.19+`、`22.12+` 或 `24+`
- npm

```bash
git clone https://github.com/yi-san-spce/time-manager.git
cd time-manager
npm ci
npm run dev
```

项目使用 `better-sqlite3` 原生模块。若安装过程中原生模块重建失败，可执行：

```bash
npm install --ignore-scripts
npx electron-rebuild -w better-sqlite3
```

### 质量检查

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Actions 会在 Windows + Node.js 22 环境中执行以上检查。

### 构建安装包

```bash
# 生成用于 GitHub Release 的 Windows x64 免安装应用包
npm run package:zip

# 只生成可直接启动的解压目录，便于本机冒烟测试
npm run package:dir

# 网络可用时生成带快捷方式与卸载程序的 NSIS 安装器
npm run package:win
```

产物位于 `release/<版本号>/`。打包流程会清理旧的构建输出、重新生成应用图标、构建 Electron 产物，并将原生依赖以 `asarUnpack` 方式保留在应用包外，确保 SQLite 与活动窗口追踪模块可以加载。

## 技术架构

| 层级 | 技术与职责 |
| --- | --- |
| 渲染进程 | React 18、TypeScript、TanStack Query、CSS Modules；负责日历、任务、追踪、统计、报告和悬浮窗界面。 |
| 进程边界 | Electron `contextIsolation`、关闭 `nodeIntegration`、类型化 preload API；渲染层不直接访问 Node/Electron 系统能力。 |
| 主进程 | Electron、Zod IPC 校验、提醒调度、番茄钟消息总线、活动窗口采样、报告导出和 AI Provider 适配。 |
| 数据层 | better-sqlite3、本地 SQLite、WAL 与版本迁移；Repository 层集中管理持久化。 |
| 验证 | Vitest 单元测试、TypeScript 类型检查、ESLint、Windows CI 与 electron-vite 生产构建。 |

```text
React Renderer
      │ 类型化 preload IPC
      ▼
Electron Main ── 服务层（追踪 / 提醒 / 报告 / AI / 悬浮窗）
      │
      ▼
Repository ── SQLite（本地用户数据目录）
```

## 隐私与安全

- 日程、任务和时间记录默认写入本地 SQLite 数据库；API Key 使用 Electron `safeStorage` 加密后保存。
- 自动追踪读取的是活动应用名和窗口标题。浏览器站点信息只从窗口标题做启发式标签提取，**不会获取精确 URL**。
- 只有标签是严格合法的完整主机名时，才会出现“打开主页”。渲染层只能传主机名，主进程会再次校验并固定构造 `https://<host>`；协议、路径、端口、IP 和无效标签都会被拒绝。
- AI 功能必须由用户主动配置并启用。调用时会向所选供应商发送该功能所需的数据，请自行评估供应商政策与网络环境。
- 卸载应用通常不会自动删除用户数据目录。需要清空数据时，请先在应用关闭后手动备份或删除其中的 `data.sqlite3`。

## 已知边界

- 活动窗口自动追踪目前针对 Windows 实现；本仓库不承诺 macOS/Linux 上的同等能力。
- 不安装浏览器扩展，因此不能恢复原始网页地址，只能在可确认完整域名时打开网站主页。
- 手动补录限定为当前选中日期内的单日记录，结束时间必须晚于开始时间。
- AI 能力依赖用户自有的供应商配置和网络可用性；它是辅助决策工具，不替代用户确认。

## 面试可展开的工程点

- **可靠的追踪落盘**：将窗口采样聚合成连续时间段，并在窗口切换、锁屏、休眠和应用退出时结算，减少记录丢失。
- **可读的时间线布局**：采用半开区间裁切单日范围，真实重叠记录分行，跨午夜记录仅显示当天可见部分；缩放、拖拽和鼠标锚点保持一致。
- **跨窗口状态一致性**：日程、任务、番茄钟与随心记在主窗口和悬浮窗之间通过受限 IPC 同步。
- **最小权限外链**：站点跳转只接受经主进程二次校验的 DNS 主机名，避免把任意 URL 或协议交给系统 Shell。
- **可验证性**：核心聚合、时间轴、域名校验、追踪服务和 IPC 输入都覆盖了自动化测试，并在 Windows CI 中持续验证。

## 项目结构

```text
src/
├─ main/                 # Electron 主进程、IPC、服务、SQLite 仓库和迁移
├─ preload/              # 受限且类型化的 IPC 桥接层
├─ renderer/src/         # React 界面、设计系统与功能模块
└─ shared/               # 跨进程数据模型和 IPC 类型
scripts/                 # 打包清理与图标生成脚本
.github/workflows/       # Windows CI
```

## License

[MIT](LICENSE)
