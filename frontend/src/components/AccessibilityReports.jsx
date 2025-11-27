import { useState } from 'react'
import { useI18n } from '../hooks/useI18n'

const predefinedIssues = ['Broken ramp', 'No braille tiles', 'Elevator not working', 'Crowded stop', 'Unsafe at night']

export const AccessibilityReports = () => {
  const { t } = useI18n()
  const [entry, setEntry] = useState('')
  const [reports, setReports] = useState([])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!entry.trim()) return
    const payload = {
      id: (window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      text: entry.trim(),
      createdAt: new Date().toISOString(),
      txId: null,
    }
    setReports([payload, ...reports])
    setEntry('')
  }

  return (
    <section className="panel-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">{t('reportsTitle')}</p>
          <h2>{t('reportsTitle')}</h2>
        </div>
      </header>
      <form className="feedback-form single" onSubmit={handleSubmit}>
        <textarea
          rows="3"
          placeholder={t('reportPlaceholder')}
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
        />
        <div className="predefined">
          {predefinedIssues.map((issue) => (
            <button
              key={issue}
              type="button"
              onClick={() => setEntry(issue)}
              className="pill"
            >
              {issue}
            </button>
          ))}
        </div>
        <button className="primary" type="submit">
          {t('reportSubmit')}
        </button>
        <p className="meta">{t('reportBlockchainHint')}</p>
      </form>
      <div className="report-list">
        {reports.map((report) => (
          <article key={report.id}>
            <p>{report.text}</p>
            <small>{new Date(report.createdAt).toLocaleString()}</small>
            {report.txId && <span>{`Tx: ${report.txId}`}</span>}
          </article>
        ))}
      </div>
    </section>
  )
}

