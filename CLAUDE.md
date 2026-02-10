# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Dungeon Idle 是一个基于 Electron + React + TypeScript 的放置类地牢游戏桌面应用。

## 常用命令

- `npm start` — 启动开发环境（Electron Forge）
- `npm run lint` — ESLint 检查
- `npm run package` — 打包应用
- `npm run make` — 创建安装包

无测试框架配置，当前无单元测试。

## 技术栈

- **Electron 40** + **Electron Forge 7** (VitePlugin)
- **React 19** + **TypeScript 5.7** (strict mode)
- **Vite 5** 构建，三个构建目标：main、preload、renderer
- **CSS Modules** + CSS 自定义属性（暗色主题）

## 架构

### Electron 进程结构

- `src/main.ts` — 主进程，窗口管理和应用生命周期
- `src/preload.ts` — 预加载脚本（当前为空占位）
- `src/renderer.tsx` — React 入口

### 状态管理

自定义 Store 模式，无第三方状态库：

- `src/core/GameStore.ts` — 单例模式，EventEmitter 订阅，快照式不可变状态
- `src/core/EventEmitter.ts` — 发布/订阅实现
- `src/hooks/useGameStore.ts` — 通过 `useSyncExternalStore` 集成 React，提供 `useGameStore()` 和 `useGameStoreSelector()` 两个 hook

### 游戏状态结构 (`src/core/types.ts`)

GameState 包含：gold、combat（战斗）、skills（技能）、shop（商店）、inventory（背包）、miningNodes（矿点）、woodcuttingNodes（伐木点）。

### UI 结构

- `App.tsx` — 基于状态的标签页路由
- `src/components/Layout/` — 侧边栏 + 主内容区布局
- `src/components/Sidebar/` — 导航标签 + 金币显示
- `src/pages/` — 五个页面：CombatPage、WoodcuttingPage、MiningPage、ShopPage、InventoryPage
- `src/components/ProgressBar/` — 可复用进度条（hp/xp/gather 变体）

### 样式体系 (`src/index.css`)

暗色主题，8 级背景色层次，CSS 自定义属性定义颜色、间距、边框等设计令牌。每个组件使用 CSS Modules 实现样式隔离。

## 代码风格

- 使用中文作为 UI 和注释语言
- if/else 等单行语句必须使用大括号包裹
- 私有成员变量使用 `_lowercase` 命名，保护/公有成员使用 `lowercase`
- Property 统一使用 `Uppercase` 命名
- 所有代码文件使用 UTF-8 编码
