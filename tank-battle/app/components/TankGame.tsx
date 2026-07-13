'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// =====================================================
// 常量与类型定义
// =====================================================
const TILE_SIZE = 32;
const MAP_COLS = 25;
const MAP_ROWS = 19;
const CANVAS_WIDTH = MAP_COLS * TILE_SIZE;  // 800
const CANVAS_HEIGHT = MAP_ROWS * TILE_SIZE; // 608

const TANK_SIZE = 28;
const TANK_SPEED = 1.6;
const BULLET_SPEED = 4.5;
const ENEMY_SHOOT_COOLDOWN = 110;          // 敌人开火冷却(帧)
const ENEMY_COUNT = 4;

const PLAYER_MAX_HEALTH = 100;
const ENEMY_MAX_HEALTH  = 100;
const PLAYER_INVINCIBLE_FRAMES = 90;       // 玩家受击后无敌时间(约 1.5s)
const PLAYER_BULLET_DAMAGE = 34;           // 玩家血量每次被打掉多少
const RESPAWN_DELAY_FRAMES  = 60;          // 死亡到重生之间的间隔

enum TileType {
  EMPTY = 0,
  BRICK = 1, // 可破坏
  STEEL = 2, // 不可破坏
  BASE = 3,  // 基地
}

enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
}

type GameState = 'playing' | 'won' | 'lost';

interface Tank {
  x: number;
  y: number;
  dir: Direction;
  speed: number;
  isPlayer: boolean;
  health: number;
  cooldown: number;       // 射击冷却
  aiDirTimer: number;     // AI 转向计时
  flash: number;          // 受击闪光
  invincible: number;     // 无敌帧数(玩家)
  dirChangeCooldown: number; // 撞墙后换方向的冷却(避免抽搐)
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  dir: Direction;
  isPlayer: boolean;
  alive: boolean;
}

interface GameRefs {
  map: number[][];
  tanks: Tank[];
  bullets: Bullet[];
  baseAlive: boolean;
  gameState: GameState;
  score: number;
  lives: number;
  level: number;
  keys: Record<string, boolean>;
  flashBase: number;
  respawnTimer: number;
  levelClearTimer: number;       // 关卡通关后延迟下一关
}

// =====================================================
// 关卡地图（0 空 / 1 砖墙 / 2 钢墙 / 3 基地）
// =====================================================
const MAP_TEMPLATE: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0],
  [1,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,1],
  [1,1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,1],
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0],
];

// =====================================================
// 主组件
// =====================================================
export default function TankGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 仅用于触发 UI 重新渲染（overlay / HUD / 重新开始按钮）
  const [uiTick, setUiTick] = useState(0);
  const [reactGameState, setReactGameState] = useState<GameState>('playing');

  // 游戏全部真实状态都在 ref 中，避免 React re-render 打断游戏循环
  const stateRef = useRef<GameRefs>({
    map: [],
    tanks: [],
    bullets: [],
    baseAlive: true,
    gameState: 'playing',
    score: 0,
    lives: 3,
    level: 1,
    keys: {},
    flashBase: 0,
    respawnTimer: 0,
    levelClearTimer: 0,
  });

  // 把 ref 状态同步到 React state（仅用于 UI 显示）
  const pushUiUpdate = useCallback(() => setUiTick(t => t + 1), []);

  // ===================================================
  // 初始化 / 重置地图 & 关卡
  // ===================================================
  // 玩家出生点（地图坐标系，列/行）
  const PLAYER_SPAWN_COL = 4;
  const PLAYER_SPAWN_ROW = MAP_ROWS - 2;

  // 把格子坐标换算成坦克中心像素坐标
  const cellCenter = (col: number, row: number) => ({
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  });

  const initLevel = useCallback((lvl: number) => {
    const s = stateRef.current;
    s.map = MAP_TEMPLATE.map(row => [...row]);
    s.bullets = [];
    s.baseAlive = true;
    s.respawnTimer = 0;
    s.levelClearTimer = 0;

    // ★ 关键：清理玩家出生点周围 3x3 范围的砖墙
    //    保证玩家永远不会被卡在墙里
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = PLAYER_SPAWN_COL + dx;
        const ty = PLAYER_SPAWN_ROW + dy;
        if (tx >= 0 && tx < MAP_COLS && ty >= 0 && ty < MAP_ROWS) {
          if (s.map[ty][tx] !== TileType.BASE) {
            s.map[ty][tx] = TileType.EMPTY;
          }
        }
      }
    }

    // 玩家出生在格子中心
    const playerPos = cellCenter(PLAYER_SPAWN_COL, PLAYER_SPAWN_ROW);
    const player: Tank = {
      x: playerPos.x,
      y: playerPos.y,
      dir: Direction.UP,
      speed: TANK_SPEED,
      isPlayer: true,
      health: PLAYER_MAX_HEALTH,
      cooldown: 0,
      aiDirTimer: 0,
      flash: 0,
      invincible: 90,
      dirChangeCooldown: 0,
      alive: true,
    };

    const tanks: Tank[] = [player];

    // ★ 关键：敌人 spawn 点全部改到画布内部
    //     原先的 (0,0) 和 (0, MAP_ROWS-2) 会让坦克左半部分出画
    const enemySpawnPoints: Array<[number, number]> = [
      [2, 1],
      [Math.floor(MAP_COLS / 2), 1],
      [MAP_COLS - 3, 1],
      [MAP_COLS - 2, 2],
    ];
    for (let i = 0; i < ENEMY_COUNT; i++) {
      const [cx, cy] = enemySpawnPoints[i % enemySpawnPoints.length];
      const pos = cellCenter(cx, cy);
      // 清理敌人 spawn 点周围 1 圈砖墙（避免卡墙）
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 0 && tx < MAP_COLS && ty >= 0 && ty < MAP_ROWS) {
            if (s.map[ty][tx] !== TileType.BASE) {
              s.map[ty][tx] = TileType.EMPTY;
            }
          }
        }
      }
      tanks.push({
        x: pos.x,
        y: pos.y,
        dir: Direction.DOWN,
        speed: TANK_SPEED * 0.8,
        isPlayer: false,
        health: ENEMY_MAX_HEALTH,
        cooldown: 60 + Math.floor(Math.random() * 80) + i * 20,
        aiDirTimer: 30 + Math.floor(Math.random() * 60),
        flash: 0,
        invincible: 0,
        dirChangeCooldown: 0,
        alive: true,
      });
    }
    s.tanks = tanks;
  }, []);

  // ===================================================
  // 工具函数
  // ===================================================
  const rectsOverlap = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const tankBounds = (t: Tank) => ({
    x: t.x - TANK_SIZE / 2,
    y: t.y - TANK_SIZE / 2,
    w: TANK_SIZE,
    h: TANK_SIZE,
  });

  const tileRect = (cx: number, cy: number) => ({
    x: cx * TILE_SIZE,
    y: cy * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
  });

  // 子弹从炮管口发射 (坦克边缘，不从中心) - 避免自伤
  const bulletMuzzleOffset = (dir: Direction): [number, number] => {
    const r = TANK_SIZE / 2 + 4; // 4px 余裕，确保子弹离开坦克 bbox
    switch (dir) {
      case Direction.UP:    return [0, -r];
      case Direction.DOWN:  return [0,  r];
      case Direction.LEFT:  return [-r, 0];
      case Direction.RIGHT: return [ r, 0];
    }
  };

  const canMoveTo = (t: Tank, nx: number, ny: number): boolean => {
    const s = stateRef.current;
    const b = { x: nx - TANK_SIZE / 2, y: ny - TANK_SIZE / 2, w: TANK_SIZE, h: TANK_SIZE };
    if (b.x < 0 || b.y < 0 || b.x + b.w > CANVAS_WIDTH || b.y + b.h > CANVAS_HEIGHT) return false;
    const x0 = Math.floor(b.x / TILE_SIZE);
    const y0 = Math.floor(b.y / TILE_SIZE);
    const x1 = Math.floor((b.x + b.w - 1) / TILE_SIZE);
    const y1 = Math.floor((b.y + b.h - 1) / TILE_SIZE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t2 = s.map[ty]?.[tx];
        if (t2 === TileType.BRICK || t2 === TileType.STEEL || t2 === TileType.BASE) {
          if (rectsOverlap(b, tileRect(tx, ty))) return false;
        }
      }
    }
    for (const other of s.tanks) {
      if (other === t || !other.alive) continue;
      if (rectsOverlap(b, tankBounds(other))) return false;
    }
    return true;
  };

  // ===================================================
  // 绘制函数
  // ===================================================
  const drawTank = (ctx: CanvasRenderingContext2D, t: Tank) => {
    const size = TANK_SIZE;
    const body = size * 0.8;
    ctx.save();
    ctx.translate(t.x, t.y);
    const rot = [0, Math.PI, -Math.PI / 2, Math.PI / 2][t.dir];
    ctx.rotate(rot);

    // 无敌闪白效果
    const isInvincibleFlicker = t.invincible > 0 && (t.invincible % 6 < 3);

    const mainColor = t.isPlayer ? '#2ecc71' : '#e74c3c';
    const dark = t.isPlayer ? '#1e8449' : '#922b21';
    const light = t.isPlayer ? '#82e0aa' : '#f1948a';

    if (t.flash > 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-size / 2, -size / 2, size, size);
    } else if (isInvincibleFlicker) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-size / 2, -size / 2, size, size);
    }

    // 履带
    ctx.fillStyle = dark;
    ctx.fillRect(-size / 2, -size / 2, size, size * 0.18);
    ctx.fillRect(-size / 2, size / 2 - size * 0.18, size, size * 0.18);
    ctx.fillStyle = '#222';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * size * 0.3, -size * 0.4, size * 0.07, 0, Math.PI * 2);
      ctx.arc(i * size * 0.3, size * 0.4, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // 车身
    ctx.fillStyle = mainColor;
    ctx.fillRect(-body / 2, -body / 2, body, body);

    ctx.fillStyle = light;
    ctx.fillRect(-body / 2, -body / 2, body, body * 0.25);

    // 炮塔
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, 0, body * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(0, 0, body * 0.24, 0, Math.PI * 2);
    ctx.fill();

    // 炮管
    ctx.fillStyle = dark;
    ctx.fillRect(-size * 0.08, -size / 2, size * 0.16, size / 2);

    ctx.restore();

    // 血条
    const hp = Math.max(0, t.health);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(t.x - size / 2, t.y - size / 2 - 8, size, 4);
    ctx.fillStyle = hp > 50 ? '#2ecc71' : hp > 25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(t.x - size / 2 + 1, t.y - size / 2 - 7, (size - 2) * (hp / 100), 2);
  };

  const drawBullet = (ctx: CanvasRenderingContext2D, b: Bullet) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = b.isPlayer ? '#fff' : '#feca57';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    const rot = [0, Math.PI, -Math.PI / 2, Math.PI / 2][b.dir];
    ctx.rotate(rot);
    ctx.fillStyle = b.isPlayer ? 'rgba(255,255,255,0.5)' : 'rgba(254,202,87,0.5)';
    ctx.fillRect(-2, -8, 4, 6);
    ctx.restore();
  };

  const drawBase = (ctx: CanvasRenderingContext2D, baseAlive: boolean) => {
    const map = stateRef.current.map;
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (map[y][x] === TileType.BASE) {
          const cx = x * TILE_SIZE + TILE_SIZE / 2;
          const cy = y * TILE_SIZE + TILE_SIZE / 2;
          ctx.save();
          ctx.fillStyle = stateRef.current.flashBase % 8 < 4 ? '#feca57' : '#fff';
          ctx.beginPath();
          ctx.moveTo(cx - 10, cy - 10);
          ctx.lineTo(cx + 10, cy - 10);
          ctx.lineTo(cx + 10, cy);
          ctx.lineTo(cx + 4, cy);
          ctx.lineTo(cx + 4, cy + 10);
          ctx.lineTo(cx - 4, cy + 10);
          ctx.lineTo(cx - 4, cy);
          ctx.lineTo(cx - 10, cy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = baseAlive ? '#2ecc71' : '#e74c3c';
          ctx.beginPath();
          ctx.arc(cx, cy - 2, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  };

  const drawMap = (ctx: CanvasRenderingContext2D) => {
    const map = stateRef.current.map;
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const t = map[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (t === TileType.BRICK) {
          ctx.fillStyle = '#a0522d';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#cd853f';
          for (let i = 0; i < 4; i++) {
            const yy = py + (i % 2) * (TILE_SIZE / 2);
            const xx = px + (i * 8) % TILE_SIZE;
            ctx.fillRect(xx, yy, TILE_SIZE - 4, 2);
          }
          ctx.strokeStyle = '#5d3a1a';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TileType.STEEL) {
          const grad = ctx.createLinearGradient(px, py, px + TILE_SIZE, py + TILE_SIZE);
          grad.addColorStop(0, '#7f8c8d');
          grad.addColorStop(0.5, '#bdc3c7');
          grad.addColorStop(1, '#566573');
          ctx.fillStyle = grad;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#34495e';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.strokeStyle = '#1abc9c';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }
      }
    }
  };

  // ===================================================
  // 玩家输入
  // ===================================================
  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = true;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      stateRef.current.keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, []);

  // ===================================================
  // "重新开始" 按钮：从 overlay 拉起，仅在 UI 层切回 playing
  // ===================================================
  const resetGame = useCallback(() => {
    const s = stateRef.current;
    s.score = 0;
    s.lives = 3;
    s.level = 1;
    s.flashBase = 0;
    s.respawnTimer = 0;
    s.levelClearTimer = 0;
    s.gameState = 'playing';
    initLevel(1);
    setReactGameState('playing');
    pushUiUpdate();
  }, [initLevel, pushUiUpdate]);

  // ===================================================
  // 主循环：单次启动，永不卸载
  // ===================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 首次进入也保证已有数据
    if (stateRef.current.tanks.length === 0) {
      initLevel(1);
    }

    let raf = 0;

    const loop = () => {
      const s = stateRef.current;

      // ===============================================
      // 游戏逻辑（仅在 playing 状态更新）
      // ===============================================
      if (s.gameState === 'playing') {
        // ---------- 关卡过渡延迟 ----------
        if (s.levelClearTimer > 0) {
          s.levelClearTimer--;
          if (s.levelClearTimer === 0) {
            s.level++;
            initLevel(s.level);
            pushUiUpdate();
          }
        } else {
          // ---------- 玩家 ----------
          const player = s.tanks[0];
          if (player) {
            if (player.invincible > 0) player.invincible--;
            if (player.flash > 0) player.flash--;

            if (player.alive && s.levelClearTimer === 0) {
              const keys = s.keys;
              if (keys['w'] || keys['arrowup']) {
                player.dir = Direction.UP;
                if (canMoveTo(player, player.x, player.y - player.speed)) {
                  player.y -= player.speed;
                }
              } else if (keys['s'] || keys['arrowdown']) {
                player.dir = Direction.DOWN;
                if (canMoveTo(player, player.x, player.y + player.speed)) {
                  player.y += player.speed;
                }
              } else if (keys['a'] || keys['arrowleft']) {
                player.dir = Direction.LEFT;
                if (canMoveTo(player, player.x - player.speed, player.y)) {
                  player.x -= player.speed;
                }
              } else if (keys['d'] || keys['arrowright']) {
                player.dir = Direction.RIGHT;
                if (canMoveTo(player, player.x + player.speed, player.y)) {
                  player.x += player.speed;
                }
              }

              if (player.cooldown > 0) player.cooldown--;
              if ((keys[' '] || keys['j']) && player.cooldown <= 0) {
                // ★ 从炮管口发射，避免自伤
                const [ox, oy] = bulletMuzzleOffset(player.dir);
                s.bullets.push({
                  x: player.x + ox,
                  y: player.y + oy,
                  dir: player.dir,
                  isPlayer: true,
                  alive: true,
                });
                player.cooldown = 18;
              }
            }
          }

          // ---------- 敌人 ----------
          const enemies = s.tanks.slice(1);
          for (const t of enemies) {
            if (!t.alive) continue;
            if (t.flash > 0) t.flash--;

            if (t.cooldown > 0) t.cooldown--;

            t.aiDirTimer++;
            if (t.aiDirTimer > 90 + Math.random() * 60) {
              t.aiDirTimer = 0;
              if (Math.random() < 0.45 && player && player.alive) {
                const dx = player.x - t.x;
                const dy = player.y - t.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                  t.dir = dx > 0 ? Direction.RIGHT : Direction.LEFT;
                } else {
                  t.dir = dy > 0 ? Direction.DOWN : Direction.UP;
                }
              } else {
                t.dir = Math.floor(Math.random() * 4);
              }
            }

            const vx = [0, 0, -1, 1][t.dir] * t.speed;
            const vy = [-1, 1, 0, 0][t.dir] * t.speed;
            if (canMoveTo(t, t.x + vx, t.y + vy)) {
              t.x += vx;
              t.y += vy;
            } else if (t.dirChangeCooldown <= 0) {
              // ★ 撞墙后只换一次方向，并在 20 帧内不再换 — 避免抽搐
              t.dir = Math.floor(Math.random() * 4);
              t.dirChangeCooldown = 20;
              t.aiDirTimer = 0;
            }
            if (t.dirChangeCooldown > 0) t.dirChangeCooldown--;

            // 敌人射击：频率降低，子弹从炮管口发射(避免击中自己)
            if (t.cooldown <= 0) {
              if (Math.random() < 0.04) {
                const [ox, oy] = bulletMuzzleOffset(t.dir);
                s.bullets.push({
                  x: t.x + ox,
                  y: t.y + oy,
                  dir: t.dir,
                  isPlayer: false,
                  alive: true,
                });
                t.cooldown = ENEMY_SHOOT_COOLDOWN + Math.floor(Math.random() * 40);
              }
            }
          }

          // ---------- 子弹 ----------
          // 先逐颗推进 + 碰撞检测（不做并发修改，安全）
          for (const b of s.bullets) {
            if (!b.alive) continue;

            // 同帧互消
            for (const ob of s.bullets) {
              if (ob === b || !ob.alive) continue;
              if (Math.hypot(b.x - ob.x, b.y - ob.y) < 8) {
                b.alive = false;
                ob.alive = false;
                break;
              }
            }
            if (!b.alive) continue;

            const vx = [0, 0, -1, 1][b.dir] * BULLET_SPEED;
            const vy = [-1, 1, 0, 0][b.dir] * BULLET_SPEED;
            b.x += vx;
            b.y += vy;

            if (b.x < 0 || b.x > CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
              b.alive = false;
              continue;
            }

            // 墙壁
            const cx = Math.floor(b.x / TILE_SIZE);
            const cy = Math.floor(b.y / TILE_SIZE);
            const tile = s.map[cy]?.[cx];
            if (tile === undefined) {
              b.alive = false;
            } else if (tile === TileType.BRICK) {
              s.map[cy][cx] = TileType.EMPTY;
              b.alive = false;
            } else if (tile === TileType.STEEL) {
              b.alive = false;
            } else if (tile === TileType.BASE) {
              s.map[cy][cx] = TileType.EMPTY;
              s.baseAlive = false;
              s.flashBase = 60;
              b.alive = false;
              s.gameState = 'lost';
              setReactGameState('lost');
            }

            // 坦克
            if (b.alive) {
              for (const t of s.tanks) {
                if (!t.alive) continue;
                // ★ 跳过同阵营：玩家子弹不会击中玩家、敌方子弹不会击中敌方
                if (b.isPlayer === t.isPlayer) continue;
                if (Math.abs(b.x - t.x) < TANK_SIZE / 2 && Math.abs(b.y - t.y) < TANK_SIZE / 2) {
                  b.alive = false;

                  if (t.isPlayer) {
                    // 玩家只有在无敌期外才会受伤
                    if (t.invincible <= 0 && t.alive) {
                      t.health -= PLAYER_BULLET_DAMAGE;
                      t.flash = 6;
                      t.invincible = PLAYER_INVINCIBLE_FRAMES;
                      if (t.health <= 0) {
                        t.alive = false;
                        s.lives = Math.max(0, s.lives - 1);
                        pushUiUpdate();
                        if (s.lives <= 0) {
                          s.gameState = 'lost';
                          setReactGameState('lost');
                        }
                      }
                    }
                  } else {
                    // 敌方
                    if (b.isPlayer) {
                      t.health -= 50;
                      t.flash = 6;
                      if (t.health <= 0) {
                        t.alive = false;
                        s.score += 100;
                        pushUiUpdate();
                      }
                    }
                  }
                  break;
                }
              }
            }
          }

          // 清理
          if (s.bullets.some(b => !b.alive)) {
            s.bullets = s.bullets.filter(b => b.alive);
          }

          // ---------- 玩家重生 ----------
          if (player && !player.alive && s.lives > 0) {
            if (s.respawnTimer === 0) {
              s.respawnTimer = 1;
              player.x = -1000;
              player.y = -1000;
            }
            s.respawnTimer++;
            if (s.respawnTimer > RESPAWN_DELAY_FRAMES) {
              const sx = 4 * TILE_SIZE;
              const sy = (MAP_ROWS - 2) * TILE_SIZE;
              const spawnBounds = {
                x: sx - TANK_SIZE / 2,
                y: sy - TANK_SIZE / 2,
                w: TANK_SIZE,
                h: TANK_SIZE,
              };
              let blocked = false;
              for (const other of s.tanks) {
                if (other === player || !other.alive) continue;
                if (rectsOverlap(spawnBounds, tankBounds(other))) {
                  blocked = true; break;
                }
              }
              if (!blocked) {
                player.x = sx;
                player.y = sy;
                player.dir = Direction.UP;
                player.health = PLAYER_MAX_HEALTH;
                player.alive = true;
                player.cooldown = 30;
                player.flash = 0;
                player.invincible = PLAYER_INVINCIBLE_FRAMES;
                s.respawnTimer = 0;
              }
            }
          }

          // ---------- 关卡通关 ----------
          const enemiesAlive = s.tanks.slice(1).some(t => t.alive);
          if (!enemiesAlive && s.levelClearTimer === 0) {
            const newLvl = s.level + 1;
            if (newLvl > 3) {
              s.gameState = 'won';
              setReactGameState('won');
            } else {
              s.levelClearTimer = 120; // 2 秒过渡
            }
          }

          if (s.flashBase > 0) s.flashBase--;
        }
      }

      // ===============================================
      // 渲染（每帧都执行，与 gameState 解耦，确保永远在画）
      // ===============================================
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < MAP_COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * TILE_SIZE, 0);
        ctx.lineTo(i * TILE_SIZE, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let i = 0; i < MAP_ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * TILE_SIZE);
        ctx.lineTo(CANVAS_WIDTH, i * TILE_SIZE);
        ctx.stroke();
      }

      drawMap(ctx);
      drawBase(ctx, s.baseAlive);

      for (const b of s.bullets) {
        if (b.alive) drawBullet(ctx, b);
      }
      for (const t of s.tanks) {
        if (t.alive) drawTank(ctx, t);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ★ 关键：空依赖，循环只在挂载时启动一次，永不被 React 打断

  // ===================================================
  // UI：根据 reactGameState（避免被游戏循环干扰）显示 overlay
  // ===================================================
  const livesText = '❤️'.repeat(stateRef.current.lives);
  const showOverlay = stateRef.current.gameState !== 'playing';

  return (
    <div className="game-wrapper" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <div className="hud">
        <div>得分: {stateRef.current.score}</div>
        <div>生命: {livesText}</div>
        <div>关卡: {stateRef.current.level}</div>
      </div>
      {showOverlay && (
        <div className="overlay">
          {reactGameState === 'won' ? (
            <>
              <h2>🎉 通关成功！</h2>
              <p>你击败了所有敌人！最终得分: {stateRef.current.score}</p>
            </>
          ) : (
            <>
              <h2>💥 游戏结束</h2>
              <p>基地被摧毁或生命用尽</p>
              <p>最终得分: {stateRef.current.score}</p>
            </>
          )}
          <button onClick={resetGame}>重新开始</button>
        </div>
      )}
    </div>
  );
}
