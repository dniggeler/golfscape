import { useEffect, useMemo, useRef, useState } from 'react'
import { buildShareUrl } from './shareLink.ts'

export type PlayedCourse = {
  id: string
  name: string
  city: string
  region: string
  country: string
  countryCode: string
}

type Props = {
  courses: PlayedCourse[]
  playedIds: Set<string>
  onSetPlayed: (ids: string[], played: boolean) => void
  onClose: () => void
}

export default function PlayedDialog({ courses, playedIds, onSetPlayed, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [onlyPlayed, setOnlyPlayed] = useState(false)
  const [shareNotice, setShareNotice] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  const share = async () => {
    const url = buildShareUrl(playedIds)
    setFallbackUrl('')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Meine gespielten Golfplätze', url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareNotice('Link kopiert')
    } catch {
      setShareNotice('Link zum Kopieren:')
      setFallbackUrl(url)
    }
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de')
    return courses.filter(
      (course) =>
        (!onlyPlayed || playedIds.has(course.id)) &&
        (!normalized || `${course.name} ${course.city} ${course.region} ${course.country}`.toLocaleLowerCase('de').includes(normalized)),
    )
  }, [courses, query, onlyPlayed, playedIds])

  const visibleIds = visible.map((course) => course.id)
  const allVisiblePlayed = visible.length > 0 && visible.every((course) => playedIds.has(course.id))

  return (
    <div className="played-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="played-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="played-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="played-header">
          <div>
            <h2 id="played-title">Gespielte Plätze</h2>
            <p>{playedIds.size} von {courses.length} Plätzen markiert</p>
          </div>
          <button type="button" className="played-close" aria-label="Schliessen" onClick={onClose}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m18 6-12 12M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="played-tools">
          <input
            type="search"
            className="played-search"
            placeholder="Platz, Ort oder Region suchen"
            aria-label="Plätze durchsuchen"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="played-actions">
            <label className="played-only">
              <input type="checkbox" checked={onlyPlayed} onChange={(event) => setOnlyPlayed(event.target.checked)} />
              Nur gespielte
            </label>
            <button
              type="button"
              className="played-bulk"
              disabled={visible.length === 0}
              onClick={() => onSetPlayed(visibleIds, !allVisiblePlayed)}
            >
              {allVisiblePlayed ? 'Alle abwählen' : 'Alle auswählen'}{query || onlyPlayed ? ` (${visible.length})` : ''}
            </button>
          </div>
        </div>

        <ul className="played-list">
          {visible.map((course) => (
            <li key={course.id}>
              <label className="played-row">
                <input
                  type="checkbox"
                  checked={playedIds.has(course.id)}
                  onChange={(event) => onSetPlayed([course.id], event.target.checked)}
                />
                <span className="played-row-copy">
                  <span className="played-row-name">{course.name}</span>
                  <span className="played-row-meta">{course.city}, {course.region} · {course.countryCode}</span>
                </span>
              </label>
            </li>
          ))}
          {visible.length === 0 && <li className="played-empty">Keine Plätze gefunden.</li>}
        </ul>

        <footer className="played-footer">
          {shareNotice && <p className="played-share-notice" role="status">{shareNotice}</p>}
          {fallbackUrl && <input className="played-share-url" readOnly value={fallbackUrl} aria-label="Link" onFocus={(event) => event.currentTarget.select()} />}
          <div className="played-footer-buttons">
            <button type="button" className="played-share" disabled={playedIds.size === 0} onClick={share}>Link teilen</button>
            <button type="button" className="played-done" onClick={onClose}>Fertig</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
