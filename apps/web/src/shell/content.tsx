import { useState } from 'react';
import officeImage from '../../../../assets/runtime/maps/office-iso.jpg';
import { team, type Member } from './team';
import { Face } from './faces';
import type { PageId } from './navigation';
import { IsoOffice } from '../office/IsoOffice';
import { ApprovalInbox, TaskBoard } from '../tasks/TaskPages';
import { Stats } from '../tasks/StatsPanel';
import { ActivityLog } from '../tasks/ActivityLog';
import { AgentsPage } from '../agents/AgentsPage';
import { AffiliatePage } from '../affiliate/AffiliatePage';
import { MemoryPage } from '../memory/MemoryPage';
import { MonitoringPage } from '../monitoring/MonitoringPage';

export function OfficeReference() {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="office-reference">
      <div className="section-heading">
        <span className="eyebrow">THE WORKPLACE</span>
        <a className="text-link" href="#/office">
          Buka peta interaktif <span aria-hidden="true">↗</span>
        </a>
      </div>
      {failed ? (
        <div className="image-fallback" role="status">
          Gambar peta tidak dapat dimuat. Delapan area tersedia pada halaman
          Kantor virtual.
        </div>
      ) : (
        <a href="#/office" aria-label="Buka peta kantor interaktif">
          <img
            src={officeImage}
            width="1376"
            height="768"
            alt="Peta isometrik kantor 204. PROJECT GROUP dengan delapan area, interior putih, taman, dan kolam."
            onError={() => setFailed(true)}
          />
        </a>
      )}
      <figcaption>
        <span>Tempat kolaborasi berikutnya.</span>
        <span className="subtle-label">8 area</span>
      </figcaption>
    </figure>
  );
}

export function TeamList({
  onSelect,
  full = false,
}: {
  onSelect: (member: Member) => void;
  full?: boolean;
}) {
  return (
    <div className={full ? 'team-grid' : 'team-list'}>
      {team.map((member) => (
        <button
          className="member"
          key={member.name}
          onClick={() => onSelect(member)}
        >
          <Face name={member.name} className={member.tone} />
          <span className="member-copy">
            <strong>{member.name}</strong>
            <span>{member.role}</span>
            {full && <small>{member.specialty}</small>}
          </span>
          <span className="member-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
      ))}
    </div>
  );
}

export function PageContent({
  page,
  onSelect,
}: {
  page: PageId;
  onSelect: (member: Member) => void;
}) {
  if (page === 'overview')
    return (
      <>
        <section className="overview-intro">
          <div>
            <span className="eyebrow">YOUR VIRTUAL HEADQUARTERS</span>
            <h2>
              Selamat datang, Leo<span className="gold">.</span>
            </h2>
            <p>
              Sebuah ruang untuk tim, ide, dan langkah besar Anda berikutnya.
            </p>
          </div>
          <a className="button button-dark" href="#/office">
            Lihat kantor <span aria-hidden="true">↗</span>
          </a>
        </section>
        <Stats />
        <div className="overview-grid">
          <OfficeReference />
          <section className="team-section">
            <div className="section-heading">
              <h2>Kenali tim Anda</h2>
              <a className="text-link" href="#/team">
                Semua <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="section-note">
              Identitas tim · belum terhubung ke AI
            </p>
            <TeamList onSelect={onSelect} />
          </section>
        </div>
        <section className="next-section">
          <div>
            <span className="eyebrow">LANGKAH BERIKUTNYA</span>
            <h2>Fondasi yang siap bertumbuh.</h2>
            <p>
              Delapan area kantor kini terhubung dan dapat dijelajahi bersama
              Akira. Penyempurnaan sprite tim menjadi tahap berikutnya.
            </p>
          </div>
          <a className="text-link" href="#/tasks">
            Lihat status workflow <span aria-hidden="true">→</span>
          </a>
        </section>
      </>
    );
  if (page === 'office') return <IsoOffice />;
  if (page === 'tasks') return <TaskBoard />;
  if (page === 'activity') return <ActivityLog />;
  if (page === 'approvals') return <ApprovalInbox />;
  if (page === 'team') return <AgentsPage />;
  if (page === 'affiliate') return <AffiliatePage />;
  if (page === 'memory') return <MemoryPage />;
  if (page === 'settings')
    return (
      <section className="settings-page">
        <span className="eyebrow">DEVELOPMENT WORKSPACE</span>
        <h2>Pengaturan belum diaktifkan</h2>
        <p>
          Preferensi lokasi, pengingat ibadah, izin, dan anggaran akan
          ditambahkan pada fase terkait.
        </p>
        <dl className="settings-list">
          <div>
            <dt>Nama produk</dt>
            <dd>204. PROJECT GROUP</dd>
          </div>
          <div>
            <dt>Mode saat ini</dt>
            <dd>Development lokal · pratinjau kantor</dd>
          </div>
          <div>
            <dt>Penyimpanan preferensi</dt>
            <dd>Belum tersedia</dd>
          </div>
          <div>
            <dt>Koneksi AI / Hermes</dt>
            <dd>Belum dikonfigurasi</dd>
          </div>
        </dl>
        <p className="section-note">
          Halaman ini bersifat informasi. Tidak menyimpan data atau kredensial.
        </p>
      </section>
    );
  return <MonitoringPage />;
}
