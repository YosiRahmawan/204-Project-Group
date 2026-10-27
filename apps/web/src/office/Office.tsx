import { useEffect, useRef, useState } from 'react';
import type { OfficeControls } from './scene';
import { destinations } from './model';
import { rooms } from './layout';
import './office.css';

export function Office() {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<OfficeControls | null>(null);
  const [status, setStatus] = useState('Memuat ruang interaktif…');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import('./scene')
      .then(({ mountOffice }) => {
        if (disposed || !host.current) return;
        controls.current = mountOffice(
          host.current,
          (message) => {
            if (!disposed) setStatus(message);
          },
          () => {
            if (!disposed) setReady(true);
          },
        );
        observer = new ResizeObserver(([entry]) => {
          if (entry)
            controls.current?.resize(
              entry.contentRect.width,
              entry.contentRect.height,
            );
        });
        observer.observe(host.current);
      })
      .catch(() => {
        if (!disposed) {
          setFailed(true);
          setStatus(
            'Ruang interaktif tidak dapat dimuat. Muat ulang halaman untuk mencoba lagi.',
          );
        }
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      controls.current?.destroy();
      controls.current = null;
    };
  }, []);

  return (
    <section className="office-play" aria-labelledby="office-title">
      <div className="office-intro">
        <div>
          <span className="eyebrow">EXPLORE THE WORKPLACE</span>
          <h2 id="office-title">
            The 204 Office<span className="gold">.</span>
          </h2>
          <p>Delapan area. Satu tempat untuk bertumbuh.</p>
        </div>
        <span className="badge">8 area terhubung · Akira dapat digerakkan</span>
      </div>
      <div className="office-toolbar" aria-label="Kontrol kamera">
        <div className="office-tool-group">
          <button
            className="button"
            disabled={!ready}
            aria-label="Perkecil peta"
            onClick={() => controls.current?.zoom(0.8)}
          >
            −
          </button>
          <button
            className="button"
            disabled={!ready}
            aria-label="Perbesar peta"
            onClick={() => controls.current?.zoom(1.25)}
          >
            +
          </button>
          <button
            className="button"
            disabled={!ready}
            onClick={() => controls.current?.reset()}
          >
            Lihat seluruh kantor
          </button>
        </div>
        <div className="office-tool-group">
          {[
            { label: 'Geser kiri', symbol: '←', x: -70, y: 0 },
            { label: 'Geser atas', symbol: '↑', x: 0, y: -70 },
            { label: 'Geser bawah', symbol: '↓', x: 0, y: 70 },
            { label: 'Geser kanan', symbol: '→', x: 70, y: 0 },
          ].map((direction) => (
            <button
              key={direction.label}
              className="button"
              aria-label={direction.label}
              disabled={!ready}
              onClick={() => controls.current?.pan(direction.x, direction.y)}
            >
              {direction.symbol}
            </button>
          ))}
        </div>
      </div>
      <div
        className="office-stage"
        ref={host}
        role="group"
        aria-label="Peta delapan area kantor. Gunakan tombol tujuan di bawah untuk menggerakkan Akira tanpa mouse."
      />
      <div className="office-room-grid" aria-label="Fokus area kantor">
        {rooms.map((room, index) => (
          <button
            key={room.id}
            className="office-room-button"
            disabled={!ready}
            onClick={() => {
              controls.current?.focus(room);
              host.current?.scrollIntoView({ block: 'center' });
            }}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{room.name}</strong>
            <small>{room.note}</small>
          </button>
        ))}
      </div>
      {!ready && (
        <p className="office-loading" role={failed ? 'alert' : 'status'}>
          {status}
        </p>
      )}
      <div className="office-bottom">
        <div className="office-agent">
          <span className="office-agent-dot" />
          <div>
            <strong>Akira</strong>
            <span>General Manager · pratinjau sprite</span>
          </div>
        </div>
        <button
          className="button"
          disabled={!ready}
          aria-pressed={paused}
          onClick={() => {
            controls.current?.pause(!paused);
            setPaused(!paused);
          }}
        >
          {paused ? 'Lanjutkan gerak' : 'Jeda gerak'}
        </button>
      </div>
      <div className="office-destinations" aria-label="Tujuan Akira">
        <span>Arahkan Akira</span>
        {destinations.map((destination) => (
          <button
            className="button"
            key={destination.name}
            disabled={!ready}
            onClick={() => controls.current?.move(destination)}
          >
            {destination.name}
          </button>
        ))}
      </div>
      <p className="office-status" role="status">
        {paused ? 'Gerakan dijeda. ' : ''}
        {ready ? status : 'Menyiapkan peta.'}
      </p>
      <p className="office-help">
        Klik lantai untuk berjalan. Tarik dengan mouse untuk menggeser peta;
        gunakan tombol kamera pada layar sentuh. Gerak mengikuti jalur di
        sekitar meja dan tanaman.
      </p>
      <p className="office-disclosure">
        Simulasi visual lokal, belum terhubung ke AI. Peta digambar dari kode
        dan tetap tajam saat diperbesar; sprite karakter berasal dari lembar
        referensi asli dan belum punya pose duduk atau berenang. Preferensi
        kurangi gerakan memindahkan karakter langsung ke tujuan.
      </p>
    </section>
  );
}
