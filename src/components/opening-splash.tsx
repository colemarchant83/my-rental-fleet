import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { theme } from '../theme';

const STAGE = 1080;
const ROW = 196;
const GAP = 28;
const SPAN = 4 * ROW + 3 * GAP;
const ROW_LEFT = (STAGE - SPAN) / 2;
const STARTS = [0, 1, 2, 3].map((i) => [ROW_LEFT + ROW / 2 + i * (ROW + GAP), 300] as const);
const LOGO = 540;
const TILE = LOGO / 2;
const LOGO_LEFT = (STAGE - LOGO) / 2;
const LOGO_TOP = 360;
const ENDS = [
  [LOGO_LEFT + TILE / 2, LOGO_TOP + TILE / 2],
  [LOGO_LEFT + TILE * 1.5, LOGO_TOP + TILE / 2],
  [LOGO_LEFT + TILE / 2, LOGO_TOP + TILE * 1.5],
  [LOGO_LEFT + TILE * 1.5, LOGO_TOP + TILE * 1.5],
] as const;
const CONTROLS = [
  [STARTS[0][0] + 40, 210],
  [STARTS[1][0] + 70, 180],
  [STARTS[2][0] - 40, 620],
  [STARTS[3][0] - 20, 680],
] as const;
const CORNERS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];

function smooth(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function bend(start: readonly [number, number], control: readonly [number, number], end: readonly [number, number], t: number) {
  const u = 1 - t;
  return [u * u * start[0] + 2 * u * t * control[0] + t * t * end[0], u * u * start[1] + 2 * u * t * control[1] + t * t * end[1]];
}

export function OpeningSplash({ onDone }: { onDone: () => void }) {
  const ref = useRef<View>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const node = ref.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !node) {
      done.current();
      return;
    }
    node.style.position = 'fixed';
    const stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;left:50%;top:50%;width:min(100vw,100dvh);height:min(100vw,100dvh);transform:translate(-50%,-50%)';
    const tiles = CORNERS.map((corner) => {
      const tile = document.createElement('div');
      tile.style.cssText = `position:absolute;transform:translate(-50%,-50%);background:url(/opening-icon.png) ${corner} / 200% 200% no-repeat;opacity:0`;
      stage.appendChild(tile);
      return tile;
    });
    const logo = document.createElement('img');
    logo.alt = '';
    logo.src = '/opening-icon.png';
    logo.style.cssText = 'position:absolute;left:25%;top:33.333%;width:50%;height:50%;object-fit:cover;opacity:0;pointer-events:none';
    stage.appendChild(logo);
    const mark = document.createElement('div');
    mark.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#e7f5ea"/><path d="M30 54 L44 68 L74 34" fill="none" stroke="#1f7a3a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    mark.style.cssText = 'position:absolute;left:50%;top:24.8%;width:16%;aspect-ratio:1;transform:translate(-50%,-50%) scale(0)';
    stage.appendChild(mark);
    node.appendChild(stage);

    let frame = 0;
    let finished = false;
    const started = performance.now();
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      node.style.transition = 'opacity 0.35s ease';
      node.style.opacity = '0';
      window.setTimeout(() => done.current(), 360);
    };
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      const fade = smooth(t / 0.45);
      const move = t < 1.35 ? 0 : t < 3.25 ? smooth((t - 1.35) / 1.9) : 1;
      const bob = 18 * (1 - fade);
      const lock = t > 3.15 ? smooth((t - 3.15) / 0.35) : 0;
      const size = ROW + (TILE - ROW) * move;
      tiles.forEach((tile, index) => {
        const [x, y] = bend(STARTS[index], CONTROLS[index], ENDS[index], move);
        tile.style.left = `${(x / STAGE) * 100}%`;
        tile.style.top = `${((y + bob) / STAGE) * 100}%`;
        tile.style.width = `${(size / STAGE) * 100}%`;
        tile.style.height = `${(size / STAGE) * 100}%`;
        tile.style.borderRadius = `${18 * (1 - lock) + 4}%`;
        tile.style.opacity = String(fade);
      });
      logo.style.opacity = String(lock);
      if (t > 3.55) {
        const pop = Math.min(1, (t - 3.55) / 0.45);
        const scale = pop < 0.7 ? 1.12 * Math.sin((pop / 0.7) * Math.PI / 2) : 1.12 - 0.12 * smooth((pop - 0.7) / 0.3);
        mark.style.transform = `translate(-50%,-50%) scale(${scale})`;
      }
      if (t < 5.6) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    const backup = window.setTimeout(finish, 7000);
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(backup);
      stage.remove();
    };
  }, []);

  return <View ref={ref} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, backgroundColor: theme.bg }} />;
}
