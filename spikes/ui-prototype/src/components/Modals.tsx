import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useEscape } from './Assistant'
import { fmtClock, projects, reviewRows, sheetRows, standupDraft, type Block, type ProjectId } from '../data'

function Modal({ title, chip, onClose, children }: { title: string; chip?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          {chip}
          <button className="icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={13} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

const stateChip: Record<string, { cls: string; label: string }> = {
  kept: { cls: 'good', label: 'wie geplant' },
  longer: { cls: 'warn', label: 'länger' },
  moved: { cls: 'warn', label: 'verschoben' },
  dropped: { cls: 'crit', label: 'entfallen' },
}

/** Abend-Review (#40): Plan vs. Ist, füttert das Standup (#19). */
export function ReviewModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  return (
    <Modal title="Abend-Review" chip={<span className="chip ai">Plan vs. Ist</span>} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reviewRows.map(r => (
          <div key={r.title} className="action-row">
            <span style={{ minWidth: 0 }}>
              <strong style={{ fontWeight: 600 }}>{r.title}</strong>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>{r.note}</span>
            </span>
            <span className={`chip ${stateChip[r.state].cls}`}>{stateChip[r.state].label}</span>
          </div>
        ))}
      </div>

      <div className="card-title" style={{ marginTop: 'var(--sp-5)' }}>
        Standup-Entwurf <span className="chip ai" style={{ marginLeft: 6 }}>KI · 1 Credit</span>
      </div>
      <pre className="standup">{standupDraft}</pre>
      <div className="briefing-row" style={{ marginTop: 'var(--sp-3)' }}>
        <button className="btn btn-primary btn-sm" onClick={() => onToast('Standup als Markdown kopiert')}>
          <Icon name="doc" size={14} /> Kopieren
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onToast('Entfallene Blöcke werden morgen erneut vorgeschlagen')}>
          Entfallenes morgen vorschlagen
        </button>
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', marginTop: 'var(--sp-3)' }}>
        Kept/Moved/Dropped wird gespeichert — die Grundlage für bessere Vorschläge (Lernschleife, post-1.0).
      </p>
    </Modal>
  )
}

/** Arbeitszeitnachweis (#38): PDF mit Unterschriftsfeldern + XLSX. */
export function ReportModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  return (
    <Modal title="Arbeitszeitnachweis · Juli 2026" chip={<span className="chip">Vorschau</span>} onClose={onClose}>
      <div className="sheet-meta">
        <span><strong>Suhay Sevinc</strong> · Workspace „Freelance“</span>
        <span>Schema v2 (Mo–Do 8:00, Fr 6:00) · Pausenregel ArbZG §4</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="sheet">
          <thead>
            <tr><th>Datum</th><th>Von</th><th>Bis</th><th>Pause</th><th>Netto</th><th>Bemerkung</th></tr>
          </thead>
          <tbody>
            {sheetRows.map(r => (
              <tr key={r.date} className={r.flag ? 'flagged' : ''}>
                <td>{r.date}</td>
                <td className="num">{r.from}</td>
                <td className="num">{r.to}</td>
                <td className="num">{r.brk}</td>
                <td className="num">{r.net}</td>
                <td>{r.flag && '⚠ '}{r.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Summe (Auszug) · Soll 38:00</td>
              <td className="num">34:54</td>
              <td>Saldo <span className="num">+3:20</span> (Monat)</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="sig-row">
        <div className="sig"><span className="sig-line" /><span>Datum, Unterschrift Mitarbeiter:in</span></div>
        <div className="sig"><span className="sig-line" /><span>Datum, Unterschrift Auftraggeber:in / Vorgesetzte:r</span></div>
      </div>

      <div className="briefing-row" style={{ marginTop: 'var(--sp-4)' }}>
        <button className="btn btn-primary btn-sm" onClick={() => onToast('PDF wird serverseitig erzeugt — Demo')}>
          <Icon name="download" size={14} /> PDF
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onToast('XLSX mit typisierten Zellen — Demo')}>
          <Icon name="download" size={14} /> Excel (XLSX)
        </button>
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', marginTop: 'var(--sp-3)' }}>
        Jede Zahl stammt aus dem deterministischen Kern; markierte Tage (⚠) werden nie stillschweigend bereinigt.
      </p>
    </Modal>
  )
}

/** Eintrag bearbeiten: Block antippen → Sheet (mobil unten, Desktop zentriert). */
export function EditSheet({ block, now, onSave, onDelete, onClose }: {
  block: Block
  now: number
  onSave: (patch: Partial<Block>) => void
  onDelete: () => void
  onClose: () => void
}) {
  useEscape(onClose)
  const [title, setTitle] = useState(block.title)
  const [project, setProject] = useState<ProjectId | undefined>(block.project)
  const [billable, setBillable] = useState(block.billable ?? false)
  const [note, setNote] = useState(block.note ?? '')
  const [start, setStart] = useState(block.start)
  const [end, setEnd] = useState(block.status === 'running' ? now : block.end)
  const running = block.status === 'running'

  const TimeAdjust = ({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) => (
    <div className="stepper-row">
      <span className="lbl">{label}</span>
      <span className="stepper">
        <button className="icon-btn" onClick={() => onChange(Math.max(min, value - 5))} aria-label={`${label} früher`}>−</button>
        <span className="num stepper-val">{fmtClock(value)}</span>
        <button className="icon-btn" onClick={() => onChange(Math.min(max, value + 5))} aria-label={`${label} später`}>+</button>
      </span>
    </div>
  )

  return (
    <div className="modal-backdrop sheet-backdrop" onClick={onClose}>
      <div className="modal edit-sheet" role="dialog" aria-label="Eintrag bearbeiten" onClick={e => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Eintrag bearbeiten</h2>
          {running && <span className="chip warn">läuft</span>}
          {block.source && <span className="chip">{block.source}</span>}
          <button className="icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="x" size={13} /></button>
        </header>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
            Titel
            <input className="text-input" value={title} onChange={e => setTitle(e.target.value)} />
          </label>

          <div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginBottom: 8 }}>Projekt</div>
            <div className="prompt-chips" style={{ marginTop: 0 }}>
              {projects.map(p => (
                <button
                  key={p.id}
                  className="chip"
                  style={project === p.id ? { borderColor: `var(--proj-${p.slot})`, color: 'var(--ink)', background: `color-mix(in srgb, var(--proj-${p.slot}) 16%, transparent)` } : undefined}
                  onClick={() => setProject(p.id)}
                >
                  <span className="dot" style={{ background: `var(--proj-${p.slot})` }} /> {p.name}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
            Notiz <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)' }}>wird Positionstext auf dem Timesheet</span>
            <textarea
              className="text-input" rows={2} maxLength={280}
              placeholder="Was wurde geliefert? (optional)"
              value={note} onChange={e => setNote(e.target.value)}
            />
          </label>

          <div className="stepper-group" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
            <TimeAdjust label="Beginn" value={start} onChange={setStart} min={6 * 60} max={end - 5} />
            {!running && <TimeAdjust label="Ende" value={end} onChange={setEnd} min={start + 5} max={20 * 60} />}
            <div className="stepper-row">
              <span className="lbl">Abrechenbar</span>
              <button className={`switch ${billable ? 'on' : ''}`} role="switch" aria-checked={billable} aria-label="Abrechenbar" onClick={() => setBillable(b => !b)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--crit)' }} onClick={() => { onDelete(); onClose() }}>
              <Icon name="trash" size={14} /> Löschen
            </button>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { onSave({ title, project, billable, note: note.trim() || undefined, start, ...(running ? {} : { end }) }); onClose() }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Onboarding/Login (Demo): E-Mail + Google + Apple, Consent-Hinweis. */
export function Onboarding({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal onboard" role="dialog" aria-label="Anmelden" onClick={e => e.stopPropagation()}>
        <div className="modal-body" style={{ textAlign: 'center', padding: 'var(--sp-6) var(--sp-5)' }}>
          <span className="brand-mark" style={{ width: 44, height: 44, fontSize: 18, margin: '0 auto', display: 'grid' }}>mD</span>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, letterSpacing: '-0.03em', margin: '14px 0 6px' }}>
            my<span style={{ color: 'var(--accent-text)' }}>Dev</span>Time
          </h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-sm)', maxWidth: 380, margin: '0 auto var(--sp-5)' }}>
            Dein Tag, geplant und erfasst — Stempeluhr, Projekte, Meetings und ein Co-Planer, der mitdenkt.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
            <button className="btn btn-primary" onClick={onClose}> Mit Apple anmelden</button>
            <button className="btn btn-ghost" onClick={onClose}>G&nbsp; Mit Google anmelden</button>
            <button className="btn btn-ghost" onClick={onClose}>@&nbsp; Mit E-Mail registrieren</button>
            <button className="btn btn-ghost btn-sm" style={{ border: 'none', color: 'var(--ink-3)' }} onClick={onClose}>
              Demo erkunden →
            </button>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-xs)', marginTop: 'var(--sp-5)', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Kalender-Zugriff und Meeting-Aufnahme verbindest du später — immer einzeln, immer widerrufbar (Consent-first).
          </p>
        </div>
      </div>
    </div>
  )
}
