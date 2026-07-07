import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useEscape } from './Assistant'
import { reviewRows, sheetRows, standupDraft } from '../data'

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
