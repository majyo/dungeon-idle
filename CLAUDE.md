# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Dungeon Idle 是一个基于 Electron + React + TypeScript 的放置类地牢游戏桌面应用。玩家管理一个冒险者公会，冒险者由 AI 自主决策（采集、购买装备、组队、副本），玩家通过建筑升级和资源管理间接影响游戏进程。

## 常用命令

- `npm start` — 启动开发环境（Electron Forge + Vite HMR）
- `npm run lint` — ESLint 检查
- `npm run package` — 打包应用
- `npm run make` — 创建安装包

无测试框架配置，当前无单元测试。

## 技术栈

- **Electron 40** + **Electron Forge 7** (VitePlugin)
- **React 19** + **TypeScript 5.7** (strict mode)
- **Vite 7** 构建，三个构建目标：main、preload、renderer
- **CSS Modules** + CSS 自定义属性（暗色主题）

## 架构

### Electron 进程结构

- `src/main.ts` — 主进程，窗口管理和应用生命周期
- `src/preload.ts` — 预加载脚本（当前为空占位）
- `src/renderer.tsx` — React 入口

### 状态管理

自定义 Store 模式，无第三方状态库：

- `src/core/GameStore.ts` — 单例模式，EventEmitter 订阅，快照式不可变状态。状态变更后创建新快照，React 通过快照比较触发重渲染
- `src/core/EventEmitter.ts` — 发布/订阅实现
- `src/hooks/useGameStore.ts` — 通过 `useSyncExternalStore` 集成 React，提供 `useGameStore()` 和 `useGameStoreSelector()` 两个 hook

### 游戏循环（Tick 系统）

`GameStore` 内部维护多个定时器驱动游戏逻辑：

- **主 tick**（1000ms）— `WorldSystem.tick()` 处理冒险者 AI 决策、行动完成判定、建筑建造进度
- **采集 tick**（200ms）— 更新采集进度条（伐木/采矿）
- **战斗 tick**（2000ms）— 副本内回合制战斗推进（在 `WorldSystem.tickRaids()` 中）

`src/core/WorldSystem.ts` 是核心模拟引擎，每个主 tick 遍历所有冒险者执行 AI 决策和行动结算。

### 冒险者 AI 系统

- `src/core/ai/AdventurerAI.ts` — 行动选择算法，基于优先级评分选择最优行动
- `src/core/ai/actions.ts` — 行动定义（rest、gather、work、buy-equipment、queue-party），每个行动包含 `canExecute`（前置条件）和 `score`（优先级评分）
- `src/core/ai/types.ts` — ActionContext、ActionDefinition 接口

冒险者状态流转：`idle` → AI 选择行动 → `resting/gathering/working/shopping/queuing` → 行动完成 → `idle`。特殊状态 `raiding` 由公会大厅系统管理，主 tick 跳过。

### 副本与组队系统

- 组队（`guildHall.formingParties`）：冒险者选择 `queue-party` 行动加入队列，满 4 人自动出发，60 秒超时解散
- 副本（`guildHall.raidingParties`）：波次制战斗，每波包含多个怪物，全部击败后进入下一波
- 副本记录（`guildHall.dungeonRecords`）：记录各副本通关次数，用于解锁后续副本

### 配置数据

- `src/core/equipmentConfig.ts` — 装备定义与辅助函数
- `src/core/monsterConfig.ts` — 怪物定义
- `src/core/dungeonConfig.ts` — 副本定义与解锁条件
- `src/core/foodConfig.ts` — 酒馆食物定义
- `src/core/initialState.ts` — 初始游戏状态工厂函数

### UI 结构

- `App.tsx` — 基于状态的标签页路由
- `src/components/Layout/` — 三栏布局：侧边栏 + 主内容区 + 行动记录面板
- `src/components/Sidebar/` — 导航标签 + 金币显示
- `src/components/ActivityLog/` — 右侧行动记录面板（最近 100 条）
- `src/components/ProgressBar/` — 可复用进度条（hp/xp/gather 变体）
- `src/components/Modal/` — 通用模态框
- `src/pages/` — 页面：BuildingPage（建筑升级/酒馆/商店进货）、GuildHallPage（组队与副本战斗可视化）、DungeonPage（副本浏览与解锁）、AdventurerPage（冒险者花名册）、WoodcuttingPage、MiningPage、ShopPage、InventoryPage、DebugPage

### 样式体系 (`src/index.css`)

暗色主题，8 级背景色层次，CSS 自定义属性定义颜色、间距、边框等设计令牌。每个组件使用 CSS Modules 实现样式隔离。

## 代码风格

- 使用中文作为 UI 和注释语言
- if/else 等单行语句必须使用大括号包裹
- 私有成员变量使用 `_lowercase` 命名，保护/公有成员使用 `lowercase`
- Property 统一使用 `Uppercase` 命名
- 所有代码文件使用 UTF-8 编码
