// Droplets and ripples drawn on a canvas laid over the pool.
const colors = ['#FFFFFF', '#38BDF8', '#7DD3FC'];

type Drop = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  decay: number;
};
type Ripple = { x: number; y: number; radius: number; max: number };

export function createSplash(canvas: HTMLCanvasElement, wrapper: HTMLElement) {
  const ctx = canvas.getContext('2d');
  let drops: Drop[] = [];
  let ripples: Ripple[] = [];
  let frame = 0;
  const timers = new Set<number>();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrapper.offsetWidth * dpr;
    canvas.height = wrapper.offsetHeight * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, wrapper.offsetWidth, wrapper.offsetHeight);
    ripples = ripples.filter((r) => {
      r.radius += 1.35;
      const opacity = (1 - r.radius / r.max) * 0.85;
      if (opacity <= 0) return false;
      // Flattened circles match the 2:1 isometric floor.
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius * 1.8, r.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = opacity;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(
        r.x,
        r.y + 1,
        r.radius * 1.7,
        r.radius * 0.8,
        0,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = opacity * 0.6;
      ctx.stroke();
      return true;
    });
    drops = drops.filter((d) => {
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.28;
      d.life -= d.decay;
      if (d.life <= 0) return false;
      ctx.globalAlpha = d.life;
      ctx.fillStyle = d.color;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), d.size, d.size);
      return true;
    });
    ctx.globalAlpha = 1;
    frame = drops.length || ripples.length ? requestAnimationFrame(draw) : 0;
  }

  const start = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const ripple = (x: number, y: number) => {
    ripples.push({ x, y, radius: 2, max: Math.random() * 26 + 22 });
    start();
  };
  const burst = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.5;
      drops.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - (Math.random() * 4 + 2),
        size: Math.random() * 3 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        life: 1,
        decay: Math.random() * 0.035 + 0.025,
      });
    }
    start();
  };

  window.addEventListener('resize', resize);
  resize();

  return {
    // Coordinates are relative to the wrapper.
    splash(x: number, y: number) {
      ripple(x, y);
      for (const delay of [90, 210]) {
        const id = window.setTimeout(() => {
          timers.delete(id);
          ripple(x, y);
        }, delay);
        timers.add(id);
      }
      burst(x, y, 24);
    },
    drip(x: number, y: number) {
      ripple(x, y);
      burst(x, y, 4);
    },
    destroy() {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
    },
  };
}
