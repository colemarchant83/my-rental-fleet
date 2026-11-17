import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { theme } from '../theme';

const STAGE = 1080;
const ROW = 196;
const LOGO = 540;
const TILE = LOGO / 2;
const LOGO_LEFT = (STAGE - LOGO) / 2;
const LOGO_TOP = 430;
const STARTS = [
  [150, 250],
  [930, 190],
  [180, 880],
  [900, 800],
] as const;
const LOOSE = [0.84, 1.08, 0.9, 1.06];
const SPIN = [-18, 14, 22, -12];
const ENDS = [
  [LOGO_LEFT + TILE / 2, LOGO_TOP + TILE / 2],
  [LOGO_LEFT + TILE * 1.5, LOGO_TOP + TILE / 2],
  [LOGO_LEFT + TILE / 2, LOGO_TOP + TILE * 1.5],
  [LOGO_LEFT + TILE * 1.5, LOGO_TOP + TILE * 1.5],
] as const;
const CONTROLS = [
  [80, 520],
  [1000, 460],
  [90, 640],
  [990, 700],
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
    logo.style.cssText = 'position:absolute;left:25%;top:39.815%;width:50%;height:50%;object-fit:cover;opacity:0;pointer-events:none';
    stage.appendChild(logo);
    const mark = document.createElement('div');
    mark.innerHTML = '<svg viewBox="0 0 100 100" width="100%" height="100%"><circle cx="50" cy="50" r="46" fill="#e7f5ea"/><path d="M30 54 L44 68 L74 34" fill="none" stroke="#1f7a3a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    mark.style.cssText = 'position:absolute;left:50%;top:29%;width:15%;aspect-ratio:1;transform:translate(-50%,-50%) scale(0)';
    stage.appendChild(mark);
    const title = document.createElement('div');
    title.textContent = 'My Rental Fleet';
    title.style.cssText = 'position:absolute;left:50%;top:13%;width:94%;text-align:center;font-weight:800;letter-spacing:-0.03em;line-height:1.05;color:#1c1917;font-family:system-ui,-apple-system,sans-serif;font-size:min(40px,9.4vw);visibility:hidden;opacity:0;transform:translate(-50%,-50%);pointer-events:none';
    stage.appendChild(title);
    node.appendChild(stage);

    let frame = 0;
    let finished = false;
    const started = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      node.style.transition = 'opacity 0.35s ease';
      node.style.opacity = '0';
      window.setTimeout(() => done.current(), 360);
    };
    const place = (move: number, fade: number, lock: number, bob: number) => {
      const sizeBase = ROW + (TILE - ROW) * move;
      tiles.forEach((tile, index) => {
        const loose = LOOSE[index] + (1 - LOOSE[index]) * move;
        const [x, y] = bend(STARTS[index], CONTROLS[index], ENDS[index], move);
        const wobble = (1 - move) * Math.sin(fade * 6 + index) * 8;
        tile.style.left = `${(x / STAGE) * 100}%`;
        tile.style.top = `${((y + bob + wobble) / STAGE) * 100}%`;
        tile.style.width = `${((sizeBase * loose) / STAGE) * 100}%`;
        tile.style.height = `${((sizeBase * loose) / STAGE) * 100}%`;
        tile.style.borderRadius = `${18 * (1 - lock) + 4}%`;
        tile.style.opacity = String(fade);
        tile.style.transform = `translate(-50%,-50%) rotate(${SPIN[index] * (1 - move)}deg)`;
      });
    };
    if (reduce) {
      place(1, 1, 1, 0);
      logo.style.opacity = '1';
      mark.style.transform = 'translate(-50%,-50%) scale(1)';
      title.style.visibility = 'visible';
      title.style.opacity = '1';
      title.style.transform = 'translate(-50%,-50%)';
      const backup = window.setTimeout(finish, 1200);
      return () => {
        finished = true;
        window.clearTimeout(backup);
        stage.remove();
      };
    }
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      const fade = smooth(t / 0.28);
      const move = t < 0.42 ? 0 : t < 2.02 ? smooth((t - 0.42) / 1.6) : 1;
      const bob = 14 * (1 - fade);
      const lock = t > 1.92 ? smooth((t - 1.92) / 0.26) : 0;
      place(move, fade, lock, bob);
      logo.style.opacity = String(lock);
      if (t > 2.24) {
        const pop = Math.min(1, (t - 2.24) / 0.34);
        const scale = pop < 0.7 ? 1.12 * Math.sin((pop / 0.7) * Math.PI / 2) : 1.12 - 0.12 * smooth((pop - 0.7) / 0.3);
        mark.style.transform = `translate(-50%,-50%) scale(${scale})`;
      }
      if (t > 2.68) {
        const rise = smooth(Math.min(1, (t - 2.68) / 0.4));
        title.style.visibility = 'visible';
        title.style.opacity = String(rise);
        title.style.transform = `translate(-50%, ${-30 - rise * 20}%)`;
      } else {
        title.style.visibility = 'hidden';
        title.style.opacity = '0';
      }
      if (t < 4.15) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    const backup = window.setTimeout(finish, 5600);
    return () => {
      finished = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(backup);
      stage.remove();
    };
  }, []);

  return <View ref={ref} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, backgroundColor: theme.bg }} />;
}
