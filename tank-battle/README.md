# 坦克大战 (Tank Battle) — Next.js

使用 **Next.js 14 (App Router) + TypeScript + Canvas** 实现的经典坦克大战小游戏。

## 功能特性

- 🎮 玩家坦克控制（W/A/S/D 或方向键移动，空格 / J 射击）
- 🤖 敌方坦克 AI（会主动追击、随机转向、自动射击）
- 🧱 多种墙体（砖墙可击碎、钢墙不可击碎）
- 🦅 基地保护（被击中即游戏结束）
- 🎯 碰撞检测 / 子弹互消 / 受击反馈
- 📈 计分 / 生命 / 多关卡
- 🎨 Canvas 纯绘制图形 + 现代化 UI 样式

## 开始使用

```bash
cd tank-battle
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可游玩。

## 操作说明

| 按键 | 功能 |
|---|---|
| `W` / `↑` | 向上移动 |
| `S` / `↓` | 向下移动 |
| `A` / `←` | 向左移动 |
| `D` / `→` | 向右移动 |
| `空格` / `J` | 发射子弹 |

## 项目结构

```
tank-battle/
├── app/
│   ├── components/
│   │   └── TankGame.tsx   # 游戏核心组件（Canvas 绘制 + 游戏循环）
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── next.config.js
├── package.json
└── tsconfig.json
```

## 游戏截图

打开 `http://localhost:3000` 后可以看到：
- 顶部 HUD 显示得分、生命、关卡
- 中央游戏区域 800×608，包含砖墙、钢墙、基地
- 玩家坦克为绿色，敌方坦克为红色
- 通关或失败时显示结果遮罩，可点击「重新开始」
