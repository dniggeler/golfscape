import { useMemo, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import coursesData from './data/golf-courses.json'
import datasetInfo from './data/dataset-info.json'
import SwissMap from './SwissMap.tsx'
import PlayedDialog from './PlayedDialog.tsx'
import './App.css'

type Course = {
  id: string
  name: string
  city: string
  region: string
  country: string
  countryCode: string
  latitude: number
  longitude: number
  labelAnchor?: 'start' | 'end'
  labelDy?: number
  holes?: number
  website?: string
  image?: {
    url: string
    attribution: string
    license: string
    sourceUrl: string
  }
  sourceUrl: string
}

const courses = coursesData as Course[]

const PLAYED_KEY = 'golfscape.played'

function loadPlayed(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function Icon({ name }: { name: 'pin' | 'search' | 'arrow' | 'golf' | 'close' }) {
  const paths = {
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M7 17 17 7M8 7h9v9" /></>,
    golf: <><path d="M12 22V3l8 3-8 3" /><path d="M4 22h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

type Sheet = 'peek' | 'half' | 'full'
const SHEET_ORDER: Sheet[] = ['peek', 'half', 'full']
const MOBILE_QUERY = '(max-width: 760px)'

function useIsMobile() {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(MOBILE_QUERY)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

// Vertikales Ziehen eines Sheet-Griffs; ein kurzer Tipp meldet dy = 0.
function useVerticalDrag(onEnd: (dy: number) => void) {
  const [state, setState] = useState<{ startY: number; dy: number } | null>(null)

  const handlers = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      setState({ startY: event.clientY, dy: 0 })
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      setState((current) => (current ? { ...current, dy: event.clientY - current.startY } : current))
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      if (!state) return
      const dy = event.clientY - state.startY
      setState(null)
      onEnd(Math.abs(dy) < 6 ? 0 : dy)
    },
    onPointerCancel: () => setState(null),
  }

  return { dy: state?.dy ?? 0, dragging: state !== null, handlers }
}

function App() {
  const isMobile = useIsMobile()
  const [sheet, setSheet] = useState<Sheet>('peek')
  const [resetKey, setResetKey] = useState(0)
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('Alle Länder')
  const [selectedCourse, setSelectedCourse] = useState<Course | undefined>()
  const [showDetails, setShowDetails] = useState(false)
  const [playedIds, setPlayedIds] = useState<Set<string>>(loadPlayed)
  const [showPlayedDialog, setShowPlayedDialog] = useState(false)

  const setPlayed = (ids: string[], played: boolean) => {
    setPlayedIds((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (played) next.add(id)
        else next.delete(id)
      }
      try {
        localStorage.setItem(PLAYED_KEY, JSON.stringify([...next]))
      } catch {
        // Speichern nicht möglich (z. B. privater Modus); Markierung gilt nur für diese Sitzung.
      }
      return next
    })
  }

  const togglePlayed = (id: string) => setPlayed([id], !playedIds.has(id))

  const countries = useMemo(() => ['Alle Länder', ...new Set(courses.map((course) => course.country))], [])
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('de')
    return courses.filter((course) => {
      const matchesCountry = countryFilter === 'Alle Länder' || course.country === countryFilter
      const matchesQuery = !normalizedQuery || `${course.name} ${course.city} ${course.region} ${course.country}`.toLocaleLowerCase('de').includes(normalizedQuery)
      return matchesCountry && matchesQuery
    })
  }, [countryFilter, query])
  const swissCount = courses.filter((course) => course.countryCode === 'CH').length
  const detailOpen = showDetails && selectedCourse !== undefined

  const openCourse = (course: Course) => {
    setSelectedCourse(course)
    setShowDetails(true)
    setSheet('peek')
  }

  const sheetDrag = useVerticalDrag((dy) => {
    const index = SHEET_ORDER.indexOf(sheet)
    let steps = Math.round(-dy / 140)
    if (steps === 0 && Math.abs(dy) >= 40) steps = dy < 0 ? 1 : -1
    if (dy === 0) steps = sheet === 'peek' ? 1 : -1
    setSheet(SHEET_ORDER[Math.min(SHEET_ORDER.length - 1, Math.max(0, index + steps))])
  })

  const detailDrag = useVerticalDrag((dy) => {
    if (dy > 80) setShowDetails(false)
  })

  return (
    <main className="app-shell">
      <aside
        className={`sidebar sheet-${sheet}${detailOpen ? ' covered' : ''}${sheetDrag.dragging ? ' dragging' : ''}`}
        style={{ '--drag': `${sheetDrag.dy}px` } as CSSProperties}
      >
        <button
          type="button"
          className="sheet-handle"
          aria-label={sheet === 'peek' ? 'Liste öffnen' : 'Liste verkleinern'}
          aria-expanded={sheet !== 'peek'}
          {...sheetDrag.handlers}
          onClick={(event) => {
            if (event.detail === 0) setSheet(sheet === 'peek' ? 'half' : 'peek')
          }}
        >
          <span />
        </button>
        <header className="brand-row">
          <a className="brand" href="#" aria-label="Golfscape Startseite">
            <span className="brand-mark"><Icon name="golf" /></span>
            <span>golfscape<span className="brand-period">.</span></span>
          </a>
          <button className="avatar" type="button" aria-label="Profil">G</button>
        </header>

        <div className="sidebar-content">
          <div className="eyebrow"><span className="eyebrow-dot" /> DEIN NÄCHSTER ABSCHLAG</div>
          <h1>Finde deinen<br /><em>Lieblingsplatz.</em></h1>
          <p className="intro">Entdecke Golfplätze in der Schweiz und direkt hinter der Grenze.</p>

          <label className="search-box">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Platz, Ort oder Region suchen"
              value={query}
              enterKeyHint="search"
              onFocus={() => {
                if (isMobile) setSheet('full')
              }}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedCourse(undefined)
                setShowDetails(false)
              }}
            />
            {query && <button type="button" aria-label="Suche löschen" onClick={() => setQuery('')}><Icon name="close" /></button>}
          </label>

          <div className="filter-heading">
            <span>GOLFPLÄTZE IN DER NÄHE</span>
            <span className="heading-actions">
              <button type="button" className="manage-played" onClick={() => setShowPlayedDialog(true)}>
                Gespielt ({playedIds.size})
              </button>
              <span className="result-count">{filteredCourses.length}</span>
            </span>
          </div>
          <div className="filter-row" role="group" aria-label="Nach Land filtern">
            {countries.map((country) => (
              <button
                key={country}
                type="button"
                className={`filter-chip ${countryFilter === country ? 'active' : ''}`}
                onClick={() => {
                  setCountryFilter(country)
                  setSelectedCourse(undefined)
                  setShowDetails(false)
                }}
              >
                {country === 'Alle Länder' ? 'Alle' : country}
              </button>
            ))}
          </div>

          <section className="course-list" aria-label="Golfplatzliste">
            {filteredCourses.map((course, index) => (
              <button
                type="button"
                className={`course-card ${selectedCourse?.id === course.id ? 'selected' : ''}`}
                key={course.id}
                onClick={() => openCourse(course)}
              >
                <span className={`course-thumb thumb-${index % 5}`} aria-hidden="true">
                  <span className="thumb-flag">{course.countryCode}</span>
                  <span className="thumb-green" />
                </span>
                <span className="course-card-copy">
                  <span className="course-name">{course.name}</span>
                  <span className="course-location"><Icon name="pin" /> {course.city}, {course.country}</span>
                  <span className="course-meta">{course.holes ? `${course.holes} Löcher` : 'Golfplatz'}<span className="meta-dot" /> {course.region}{playedIds.has(course.id) && <><span className="meta-dot" /><span className="played-badge">Gespielt</span></>}</span>
                </span>
                <Icon name="arrow" />
              </button>
            ))}
            {filteredCourses.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon"><Icon name="search" /></span>
                <strong>Nichts gefunden</strong>
                <p>Versuche einen anderen Ort oder passe den Länderfilter an.</p>
              </div>
            )}
          </section>
          <div className="data-note">
            <span className="note-icon">i</span>
            <p>{courses.length} Plätze – davon {swissCount} in der Schweiz (Quelle: Swiss Golf). Koordinaten können leicht abweichen.</p>
          </div>
        </div>
        <footer className="sidebar-footer">
          <span>Ein guter Tag beginnt draussen.</span>
          <span>© 2026 golfscape</span>
        </footer>
      </aside>

      <section
        className="map-panel"
        aria-label="Karte der Golfplätze"
        onPointerDown={() => {
          if (sheet !== 'peek') setSheet('peek')
        }}
      >
        <div className="map-topbar">
          <a className="map-brand" href="#" aria-label="Golfscape Startseite">
            <span className="brand-mark"><Icon name="golf" /></span>
            <span>golfscape<span className="brand-period">.</span></span>
          </a>
          <div className="map-context">
            <span className="live-dot" />
            <span>Schweiz &amp; Umgebung</span>
            <span className="context-divider">/</span>
            <span className="context-muted">bis 50 km ab Grenze</span>
          </div>
          <button className="map-button" type="button" aria-label="Übersicht anzeigen" onClick={() => {
            setCountryFilter('Alle Länder')
            setQuery('')
            setSelectedCourse(undefined)
            setShowDetails(false)
            setResetKey((key) => key + 1)
          }}>
            <Icon name="pin" /> <span className="map-button-label">Übersicht anzeigen</span>
          </button>
        </div>
        <SwissMap
          courses={filteredCourses}
          selectedId={selectedCourse?.id}
          playedIds={playedIds}
          resetKey={resetKey}
          focusOffset={isMobile && detailOpen ? 0.22 : 0}
          onSelect={(id) => {
            const course = courses.find((item) => item.id === id)
            if (course) openCourse(course)
          }}
        />
        <button type="button" className="map-legend" aria-label="Gespielte Plätze verwalten" onClick={() => setShowPlayedDialog(true)}><span className="legend-dot" /> Offen <span className="legend-dot played" /> Gespielt ({playedIds.size}) <span className="legend-divider" /> <span className="legend-scope">CH + Grenzregion</span></button>

        {showDetails && selectedCourse && (
          <aside
            className={`detail-panel${detailDrag.dragging ? ' dragging' : ''}`}
            style={detailDrag.dy > 0 ? { transform: `translateY(${detailDrag.dy}px)` } : undefined}
          >
            <div className="sheet-handle detail-handle" aria-hidden="true" {...detailDrag.handlers}><span /></div>
            <button className="detail-close" type="button" aria-label="Details schliessen" onClick={() => setShowDetails(false)}><Icon name="close" /></button>
            {selectedCourse.image ? (
              <img className="detail-image" src={selectedCourse.image.url} alt={`Golfplatz ${selectedCourse.name}`} />
            ) : (
              <div className="detail-art" aria-label="Golfplatzbild derzeit nicht verfügbar"><span className="art-sun" /><span className="art-hill art-hill-back" /><span className="art-hill art-hill-front" /><span className="art-flag">⚑</span><span className="art-caption">GOLFSCAPE · {selectedCourse.countryCode}</span></div>
            )}
            <div className="detail-body">
              <span className="detail-kicker">{selectedCourse.country} <span>·</span> {selectedCourse.region}</span>
              <h2>{selectedCourse.name}</h2>
              <p className="detail-location"><Icon name="pin" /> {selectedCourse.city}</p>
              <div className="detail-facts">
                <div><span>ANLAGE</span><strong>{selectedCourse.holes ? `${selectedCourse.holes} Löcher` : 'Golfplatz'}</strong></div>
                <div><span>LAND</span><strong>{selectedCourse.countryCode}</strong></div>
              </div>
              <button
                type="button"
                className={`played-toggle${playedIds.has(selectedCourse.id) ? ' active' : ''}`}
                aria-pressed={playedIds.has(selectedCourse.id)}
                onClick={() => togglePlayed(selectedCourse.id)}
              >
                {playedIds.has(selectedCourse.id) ? 'Als gespielt markiert ✓' : 'Als gespielt markieren'}
              </button>
              <div className="detail-links">
                {selectedCourse.website && <a href={selectedCourse.website} target="_blank" rel="noreferrer">Website des Clubs <Icon name="arrow" /></a>}
                <a href={selectedCourse.sourceUrl} target="_blank" rel="noreferrer">Quelle <Icon name="arrow" /></a>
              </div>
              {selectedCourse.image && <p className="image-credit">Bild: {selectedCourse.image.attribution} · {selectedCourse.image.license}</p>}
            </div>
          </aside>
        )}

        <div className="map-disclaimer">
          <span>Datengrundlage: {datasetInfo.dataSource}</span>
          <span>Stand: {datasetInfo.lastUpdated}</span>
        </div>
      </section>
      {showPlayedDialog && (
        <PlayedDialog
          courses={courses}
          playedIds={playedIds}
          onSetPlayed={setPlayed}
          onClose={() => setShowPlayedDialog(false)}
        />
      )}
    </main>
  )
}

export default App
