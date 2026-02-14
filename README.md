# Dungeon Idle

基于 Electron + React + TypeScript 的放置类地牢游戏桌面应用。

玩家管理一个冒险者公会，冒险者由 AI 自主决策——采集资源、购买装备、组队、攻略副本——玩家通过建筑升级和资源管理间接影响游戏进程。

## 游戏特色

- **AI 驱动的冒险者**：每位冒险者拥有独立 AI，自动选择最优行动（休息、采集、打工、购买装备、排队组队）
- **职能组队系统**：坦克 / DPS / 治疗三职能自动匹配，4 人队伍自动出发攻略副本
- **回合制战斗**：按速度排序的回合制战斗，4 职业各有 2-3 个自动释放的技能
  - 战士：嘲讽吸引火力、盾击眩晕敌人
  - 弓箭手：多重射击 AOE、致命一击集火低血目标
  - 元素法师：火球术群伤附带灼烧、冰枪冻结
  - 生命法师：治愈术回复队友、祝福全队护盾
- **状态效果**：嘲讽、眩晕、灼烧、冻结、护盾、防御提升
- **Boss 技能**：哥布林首领战吼、死亡骑士死亡斩击、大地魔像地震、恶魔领主地狱火、龙王龙息
- **建筑升级**：工会大厅（解锁冒险者上限）、酒馆（回复体力）、杂货店（装备进货）
- **采集系统**：伐木 / 采矿获取建筑材料
- **6 个副本**：从哥布林洞穴到龙王巢穴，逐步解锁

## 技术栈

- Electron 40 + Electron Forge 7
- React 19 + TypeScript 5.7 (strict mode)
- Vite 7 构建
- CSS Modules + CSS 自定义属性（暗色主题）
- 自定义 Store 模式（无第三方状态库）

## 开发

```bash
# 安装依赖
npm install

# 启动开发环境（Electron + Vite HMR）
npm start

# ESLint 检查
npm run lint

# 打包应用
npm run package

# 创建安装包
npm run make
```

## 项目结构

```
src/
├── main.ts                  # Electron 主进程
├── preload.ts               # 预加载脚本
├── renderer.tsx             # React 入口
├── App.tsx                  # 标签页路由
├── core/
│   ├── types.ts             # 类型定义
│   ├── GameStore.ts         # 状态管理（单例 + EventEmitter）
│   ├── WorldSystem.ts       # 核心模拟引擎
│   ├── adventurerConfig.ts  # 冒险者配置与生成
│   ├── equipmentConfig.ts   # 装备定义
│   ├── monsterConfig.ts     # 怪物定义
│   ├── dungeonConfig.ts     # 副本定义
│   ├── foodConfig.ts        # 酒馆食物定义
│   ├── initialState.ts      # 初始状态
│   ├── ai/                  # 冒险者 AI 决策
│   │   ├── AdventurerAI.ts
│   │   ├── actions.ts
│   │   └── types.ts
│   └── combat/              # 战斗系统
│       ├── skills.ts        # 技能定义（4 职业 10 技能）
│       ├── combatAI.ts      # 技能选择与目标选择
│       └── combatEngine.ts  # 战斗引擎
├── components/              # 通用组件
│   ├── Layout/
│   ├── Sidebar/
│   ├── ActivityLog/
│   ├── ProgressBar/
│   └── Modal/
├── pages/                   # 页面
│   ├── BuildingPage/
│   ├── GuildHallPage/
│   ├── DungeonPage/
│   ├── AdventurerPage/
│   ├── WoodcuttingPage/
│   ├── MiningPage/
│   ├── ShopPage/
│   ├── InventoryPage/
│   └── DebugPage/
└── hooks/
    └── useGameStore.ts      # React 集成 hook
```

## 许可证

[MIT](LICENSE)
