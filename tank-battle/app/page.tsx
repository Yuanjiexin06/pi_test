import TankGame from './components/TankGame';

export default function Home() {
  return (
    <main>
      <h1>坦克大战</h1>
      <p className="subtitle">经典坦克大战 · Next.js + Canvas 实现</p>
      <TankGame />
      <div className="controls">
        <span>W A S D / 方向键 — 移动</span>
        <span>空格 / J — 射击</span>
        <span>目标 — 保护基地，消灭所有敌方坦克</span>
      </div>
    </main>
  );
}
