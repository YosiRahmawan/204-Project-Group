import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pages, resolvePage } from './shell/navigation';
import { PageContent } from './shell/content';
import { type Member } from './shell/team';
import { useHealth } from './shell/use-health';

function subscribeToHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function App() {
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => '',
  );
  const page = resolvePage(hash);
  const { status, retry } = useHealth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousHash = useRef(hash);

  useEffect(() => {
    document.title = `${page.label} · 204. PROJECT GROUP`;
    if (previousHash.current !== hash) {
      dialog.current?.close();
      heading.current?.focus();
    }
    previousHash.current = hash;
  }, [hash, page.id, page.label]);

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected && dialog.current?.open) dialog.current.close();
  }, [selected]);

  const statusLabels = {
    loading: 'Memeriksa backend…',
    connected: 'Backend terhubung',
    error: 'Backend tidak terjangkau',
    offline: 'Perangkat offline',
  };

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        Lewati ke konten
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#/overview"
          aria-label="204. PROJECT GROUP — Ringkasan"
        >
          <span className="brand-number">
            204<span>.</span>
          </span>
          <span className="brand-name">PROJECT GROUP</span>
        </a>
        <div className="workspace-label">
          VIRTUAL HEADQUARTERS <span>01</span>
        </div>
        <button
          className="menu-toggle button"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? 'Tutup navigasi' : 'Buka navigasi'}{' '}
          <span aria-hidden="true">{menuOpen ? '−' : '+'}</span>
        </button>
        <nav
          id="main-navigation"
          className={menuOpen ? 'navigation open' : 'navigation'}
          aria-label="Navigasi utama"
        >
          {pages.map((item, index) => (
            <a
              key={item.id}
              href={`#/${item.id}`}
              aria-current={item.id === page.id ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {item.label}
              <span className="nav-indicator" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="phase-note">
            <span className="eyebrow">SEDANG DIBANGUN</span>
            <strong>Ruang ide besar Anda.</strong>
            <p>
              Delapan area terhubung.
              <br />
              Satu karakter percobaan · AI belum aktif.
            </p>
          </div>
          <div className="owner-profile">
            <span className="avatar owner-avatar" aria-hidden="true">
              L
            </span>
            <div>
              <strong>Leo</strong>
              <span>CEO manusia · Human Owner</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span aria-hidden="true">/</span>{' '}
            <strong>{page.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-tag">LOCAL DEVELOPMENT</span>
            <span className="topbar-owner">
              Leo{' '}
              <span className="avatar owner-avatar" aria-hidden="true">
                L
              </span>
            </span>
          </div>
        </header>
        <div className="connection-bar">
          <span className={`connection-status ${status}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            {statusLabels[status]}
          </span>
          <span className="connection-description">
            Health API saja · AI belum aktif
          </span>
          <button
            className="retry-button"
            onClick={retry}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Memeriksa…' : 'Periksa ulang'}
          </button>
        </div>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">204. PROJECT GROUP</p>
              <h1 tabIndex={-1} ref={heading}>
                {page.label}
              </h1>
              <p>{page.description}</p>
            </div>
            <span className="phase-label">
              TAHAP 02 <span>Pratinjau kantor</span>
            </span>
          </div>
          <PageContent page={page.id} onSelect={setSelected} />
          <footer className="workspace-footer">
            <span>204. PROJECT GROUP</span>
            <span>
              Map delapan area · satu karakter uji. Integrasi AI belum
              diaktifkan.
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        className="member-dialog"
        aria-labelledby="member-title"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="dialog-top">
              <span className="eyebrow">PROFIL TIM</span>
              <button
                className="button"
                onClick={() => dialog.current?.close()}
              >
                Tutup <span aria-hidden="true">×</span>
              </button>
            </div>
            <span
              className={`avatar large ${selected.tone}`}
              aria-hidden="true"
            >
              {selected.initials}
            </span>
            <h2 id="member-title">{selected.name}</h2>
            <p className="dialog-role">
              {selected.role} / {selected.specialty}
            </p>
            <p>{selected.description}</p>
            <dl className="settings-list">
              <div>
                <dt>Status integrasi</dt>
                <dd>Belum terhubung</dd>
              </div>
              <div>
                <dt>Task aktif</dt>
                <dd>Belum tersedia</dd>
              </div>
              <div>
                <dt>Aktivitas visual</dt>
                <dd>
                  {selected.name === 'Akira'
                    ? 'Pratinjau gerak antar-area kantor'
                    : 'Belum diimplementasikan'}
                </dd>
              </div>
            </dl>
            <div className="dialog-note">
              Profil ini mendeskripsikan peran yang direncanakan. Tidak ada
              proses AI yang dijalankan.
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
