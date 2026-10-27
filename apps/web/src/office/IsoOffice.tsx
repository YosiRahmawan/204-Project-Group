import { useEffect, useRef, useState } from 'react';
import '@fontsource/playfair-display/500.css';
import mapUrl from '../../../../assets/runtime/maps/office-iso.jpg';
import { zones, type Zone } from './zones';
import { createSplash } from './splash';
import './iso-office.css';

const mapWidth = 1376;
const mapHeight = 768;

// Pan and zoom that centre a zone in the frame; null shows the whole office.
function frameTransform(zone: Zone | null) {
  if (!zone) return 'translate(0%, 0%) scale(1)';
  const points = zone.points
    .split(' ')
    .map((p) => p.split(',').map(Number) as [number, number]);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(
    mapWidth / (width + 160),
    mapHeight / (height + 120),
    2.2,
  );
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return `translate(${50 - ((scale * cx) / mapWidth) * 100}%, ${50 - ((scale * cy) / mapHeight) * 100}%) scale(${scale})`;
}

export function IsoOffice() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const duck = useRef<SVGGElement>(null);
  const splash = useRef<ReturnType<typeof createSplash> | null>(null);

  const active = zones.find((z) => z.id === activeId) ?? null;
  const hover = zones.find((z) => z.id === hoverId) ?? null;
  const step = (offset: number) => {
    const index = zones.findIndex((z) => z.id === activeId);
    const from = index === -1 ? (offset > 0 ? -1 : 0) : index;
    setActiveId(zones[(from + offset + zones.length) % zones.length]!.id);
  };

  // The map is scaled by CSS when zoomed, so screen points are converted back to map pixels.
  const toMap = (clientX: number, clientY: number) => {
    const box = wrapper.current?.getBoundingClientRect();
    const own = wrapper.current?.offsetWidth ?? 0;
    if (!box || !own) return null;
    const factor = box.width / own;
    return {
      x: (clientX - box.left) / factor,
      y: (clientY - box.top) / factor,
    };
  };

  useEffect(() => {
    if (!wrapper.current || !canvas.current) return;
    const engine = createSplash(canvas.current, wrapper.current);
    splash.current = engine;
    // The duck leaves a small ripple wherever it floats.
    const timer = window.setInterval(() => {
      const box = duck.current?.getBoundingClientRect();
      const point =
        box && box.width > 0
          ? toMap(box.left + box.width / 2, box.top + box.height / 2)
          : null;
      if (point) engine.drip(point.x, point.y);
    }, 4200);
    return () => {
      window.clearInterval(timer);
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveId(null);
      if (event.key === 'ArrowRight' && activeId) step(1);
      if (event.key === 'ArrowLeft' && activeId) step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const poolClick = (event: { clientX: number; clientY: number }) => {
    const point = toMap(event.clientX, event.clientY);
    if (point) splash.current?.splash(point.x, point.y);
    setActiveId('pool');
  };

  const polygon = (zone: Zone) => ({
    key: zone.id,
    id: `poly-${zone.id}`,
    className: zone.id === activeId ? 'room-poly active' : 'room-poly',
    points: zone.points,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': `${zone.tag}: ${zone.name}`,
    onMouseEnter: () => setHoverId(zone.id),
    onMouseLeave: () => setHoverId(null),
    onFocus: () => setHoverId(zone.id),
    onBlur: () => setHoverId(null),
  });

  return (
    <section
      className="iso-office"
      aria-label="Peta isometrik kantor 204. Project Group"
    >
      <div
        ref={stage}
        className="relative w-full aspect-[16/9] bg-white select-none overflow-hidden"
        onMouseMove={(event) => {
          const area = event.currentTarget.getBoundingClientRect();
          setTip({
            x: event.clientX - area.left + 15,
            y: event.clientY - area.top + 15,
          });
        }}
      >
        <div
          ref={wrapper}
          className="absolute inset-0 origin-top-left"
          style={{
            transform: frameTransform(active),
            transition: 'transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <img
            alt="Isometric pixel art floor plan of 204 Project Group: garden, pool, workspace, lobby, lounge, prayer room, approval room and command room"
            className="w-full h-full object-contain pointer-events-none"
            src={mapUrl}
            width="1376"
            height="768"
          />

          <svg
            className="absolute inset-0 w-full h-full z-[5] pointer-events-none"
            viewBox="0 0 1376 768"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="pool-caustic-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="jacuzzi-radial" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.65" />
                <stop offset="80%" stopColor="#38BDF8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sign-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f1d68b" />
                <stop offset="55%" stopColor="#d1a14b" />
                <stop offset="100%" stopColor="#a67a2c" />
              </linearGradient>
              <filter
                id="lantern-blur"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
              </filter>
            </defs>

            {/* The logo is lettered straight onto the lobby's marble feature wall. */}
            <g>
              <text
                x="676"
                y="538"
                textAnchor="middle"
                fontFamily="'Playfair Display', Georgia, serif"
                fontSize="38"
                fontWeight="500"
                fill="url(#sign-gold)"
                stroke="#8a6320"
                strokeWidth="0.3"
                style={{
                  filter: 'drop-shadow(0 1px 0.8px rgba(80, 55, 15, 0.4))',
                }}
              >
                204.
              </text>
              <text
                x="676"
                y="549"
                textAnchor="middle"
                fontFamily="'Segoe UI', system-ui, sans-serif"
                fontSize="6"
                fontWeight="300"
                letterSpacing="3.2"
                fill="#a37b32"
              >
                PROJECT GROUP
              </text>
            </g>

            <g>
              <path
                className="pool-caustics-1"
                d="M 914,120 L 1128,120 L 1134,212 L 920,212 Z"
                fill="url(#pool-caustic-grad)"
                opacity="0.45"
                style={{ mixBlendMode: 'overlay' }}
              />
              <g
                className="pool-caustics-2"
                fill="none"
                opacity="0.4"
                stroke="#FFFFFF"
                strokeLinecap="round"
                strokeWidth="1.2"
              >
                <path d="M 930,135 Q 960,130 995,136 T 1060,133 T 1115,137" />
                <path d="M 925,155 Q 970,162 1015,154 T 1075,158 T 1125,153" />
                <path d="M 935,178 Q 980,172 1025,179 T 1085,174 T 1120,179" />
                <path d="M 945,198 Q 995,204 1045,197 T 1105,200" />
              </g>
              <g opacity="0.65">
                <circle
                  className="animate-pulse"
                  cx="950"
                  cy="142"
                  fill="#FFFFFF"
                  r="1.5"
                />
                <circle
                  className="animate-pulse"
                  cx="1035"
                  cy="165"
                  fill="#FFFFFF"
                  r="2"
                  style={{ animationDuration: '2.2s' }}
                />
                <circle
                  className="animate-pulse"
                  cx="1090"
                  cy="138"
                  fill="#FFFFFF"
                  r="1.5"
                  style={{ animationDuration: '3.1s' }}
                />
                <circle
                  className="animate-pulse"
                  cx="980"
                  cy="190"
                  fill="#FFFFFF"
                  r="1.8"
                  style={{ animationDuration: '2.8s' }}
                />
                <circle
                  className="animate-pulse"
                  cx="1060"
                  cy="195"
                  fill="#FFFFFF"
                  r="1.6"
                  style={{ animationDuration: '1.9s' }}
                />
              </g>
              <ellipse
                cx="1152"
                cy="132"
                fill="url(#jacuzzi-radial)"
                opacity="0.55"
                rx="34"
                ry="18"
              />
              <g fill="#FFFFFF" stroke="#BAE6FD" strokeWidth="0.5">
                {[
                  [1140, 134, 2, 0],
                  [1156, 128, 2.5, 0.4],
                  [1148, 138, 1.8, 0.8],
                  [1165, 133, 2.2, 1.2],
                  [1136, 129, 1.6, 1.6],
                ].map(([cx, cy, r, delay]) => (
                  <circle
                    key={`${cx}-${cy}`}
                    className="jacuzzi-bubble"
                    cx={cx}
                    cy={cy}
                    r={r}
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </g>
              <g ref={duck} className="pool-duck-swimmer">
                <ellipse
                  className="animate-ping"
                  cx="976"
                  cy="167"
                  fill="none"
                  opacity="0.6"
                  rx="8"
                  ry="4"
                  stroke="#7DD3FC"
                  strokeWidth="1"
                  style={{
                    animationDuration: '3s',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                />
                <ellipse cx="976" cy="164" fill="#FACC15" rx="5.5" ry="4" />
                <circle cx="980" cy="161.5" fill="#FACC15" r="3.2" />
                <circle cx="981.2" cy="160.8" fill="#1E293B" r="0.7" />
                <polygon
                  fill="#F97316"
                  points="982.5,161.5 985,162.5 982.5,163.2"
                />
                <path
                  d="M 973,164 Q 976,166 978,163"
                  fill="none"
                  stroke="#EAB308"
                  strokeWidth="1"
                />
              </g>
            </g>
            <g>
              <g className="garden-tree-crown">
                <ellipse
                  cx="622"
                  cy="110"
                  fill="#84CC16"
                  filter="url(#lantern-blur)"
                  opacity="0.08"
                  rx="66"
                  ry="48"
                />
                <path
                  d="M 580,95 Q 620,70 665,90 Q 690,120 665,140 Q 615,155 585,135 Z"
                  fill="#A3E635"
                  opacity="0.05"
                />
              </g>
              <g className="garden-tree-secondary">
                <ellipse
                  cx="510"
                  cy="50"
                  fill="#84CC16"
                  filter="url(#lantern-blur)"
                  opacity="0.07"
                  rx="38"
                  ry="32"
                />
              </g>
              <g
                className="garden-tree-secondary"
                style={{ animationDuration: '4.8s', animationDelay: '1.2s' }}
              >
                <ellipse
                  cx="815"
                  cy="220"
                  fill="#84CC16"
                  filter="url(#lantern-blur)"
                  opacity="0.06"
                  rx="32"
                  ry="28"
                />
              </g>
              <circle
                className="lantern-light"
                cx="620"
                cy="184"
                fill="#FFF1D6"
                filter="url(#lantern-blur)"
                opacity="0.7"
                r="10"
              />
              <circle cx="620" cy="184" fill="#FEF08A" r="2.5" />
              <circle
                className="lantern-light"
                cx="738"
                cy="116"
                fill="#FFF1D6"
                filter="url(#lantern-blur)"
                opacity="0.6"
                r="8"
                style={{ animationDelay: '1.1s' }}
              />
              <circle cx="738" cy="116" fill="#FEF08A" r="2" />
              <circle
                className="lantern-light"
                cx="778"
                cy="116"
                fill="#FFF1D6"
                filter="url(#lantern-blur)"
                opacity="0.6"
                r="8"
                style={{ animationDelay: '1.8s' }}
              />
              <circle cx="778" cy="116" fill="#FEF08A" r="2" />
            </g>
          </svg>

          <canvas
            ref={canvas}
            className="absolute inset-0 w-full h-full z-10 pointer-events-none"
          />

          <svg
            className="absolute inset-0 w-full h-full z-20"
            viewBox="0 0 1376 768"
            preserveAspectRatio="xMidYMid meet"
          >
            {zones.map((zone) => (
              <polygon
                {...polygon(zone)}
                onClick={
                  zone.id === 'pool' ? poolClick : () => setActiveId(zone.id)
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  if (zone.id === 'pool') {
                    const box = event.currentTarget.getBoundingClientRect();
                    poolClick({
                      clientX: box.left + box.width / 2,
                      clientY: box.top + box.height / 2,
                    });
                  } else setActiveId(zone.id);
                }}
              />
            ))}
            <g className="pointer-events-none" aria-hidden="true">
              {zones.map((zone) => (
                <g
                  key={zone.id}
                  className="room-pin"
                  transform={`translate(${zone.pin[0]}, ${zone.pin[1]})`}
                >
                  <circle fill="#3B82F6" opacity="0.2" r="12" />
                  <circle fill="#2563EB" r="6" />
                  <circle fill="#FFFFFF" r="2.5" />
                </g>
              ))}
            </g>
          </svg>
        </div>

        <div
          className="absolute pointer-events-none z-30 bg-slate-900/90 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-xl flex items-center space-x-2 border border-slate-700"
          style={{
            left: tip.x,
            top: tip.y,
            visibility: hover ? 'visible' : 'hidden',
          }}
          aria-hidden="true"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>{hover ? `${hover.tag} • ${hover.name}` : ''}</span>
        </div>
      </div>

      {active && (
        <div className="zone-detail" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-mono-code text-xs font-semibold">
                {active.tag}
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Architecture Spec
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
                onClick={() => step(-1)}
              >
                Previous
              </button>
              <button
                className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                onClick={() => step(1)}
              >
                Next Zone
              </button>
              <button
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
                onClick={() => setActiveId(null)}
              >
                Lihat seluruh kantor
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {active.name}
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {active.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Total Capacity', active.capacity],
              ['Floor Surface', active.area],
              ['Ambient Sound', active.acoustic],
            ].map(([label, value]) => (
              <div
                key={label}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="text-[11px] font-medium text-slate-400">
                  {label}
                </div>
                <div className="text-base font-semibold text-slate-800 mt-0.5">
                  {value}
                </div>
              </div>
            ))}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-medium text-slate-400">
                Status
              </div>
              <div className="text-base font-semibold text-emerald-600 flex items-center space-x-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{active.status}</span>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Design &amp; Furnishing
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {active.desc}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                Key Amenities &amp; Gear
              </h3>
              <ul className="space-y-2 text-xs text-slate-700">
                {active.amenities.map((item) => (
                  <li
                    key={item}
                    className="flex items-center space-x-2 text-slate-600"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="zone-grid" role="group" aria-label="Fokus area kantor">
        {zones.map((zone, index) => (
          <button
            key={zone.id}
            className="zone-button"
            aria-pressed={zone.id === activeId}
            onClick={() => setActiveId(zone.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{zone.label}</strong>
            <small>{zone.note}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
