import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import geometry from './data/map-geometry.json'

export type MapCourse = {
  id: string
  name: string
  latitude: number
  longitude: number
  labelAnchor?: 'start' | 'end'
  labelDy?: number
}

type Props = {
  courses: MapCourse[]
  selectedId?: string
  playedIds: Set<string>
  onSelect: (id: string) => void
  resetKey?: number
  focusOffset?: number
}

type Point = [number, number]
type View = { cx: number; cy: number; w: number }

const WIDTH = 1100
const MAX_ZOOM = 8
const { west, east, south, north } = geometry.bounds
const lonScale = Math.cos((((south + north) / 2) * Math.PI) / 180)
const scale = WIDTH / ((east - west) * lonScale)
const HEIGHT = Math.round((north - south) * scale)

const project = (lat: number, lon: number): Point => [
  Math.round((lon - west) * lonScale * scale * 10) / 10,
  Math.round((north - lat) * scale * 10) / 10,
]

const toPath = (points: number[][]) =>
  points.map(([lon, lat], index) => `${index ? 'L' : 'M'}${project(lat, lon).join(' ')}`).join(' ') + 'Z'

const cityById = new Map(geometry.cities.map((city) => [city.id, city]))

const roadPaths = geometry.roads.map((road) =>
  road
    .map((id, index) => {
      const city = cityById.get(id)!
      return `${index ? 'L' : 'M'}${project(city.lat, city.lon).join(' ')}`
    })
    .join(' '),
)

const borderPath = toPath(geometry.border)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const fitWidth = (aspect: number) => Math.max(WIDTH, HEIGHT * aspect)
const initialView = (aspect: number): View => {
  const portrait = aspect < 1
  const w = portrait ? fitWidth(aspect) / 1.15 : fitWidth(aspect)
  return { cx: WIDTH / 2, cy: HEIGHT / 2 + (portrait ? (w / aspect) * 0.1 : 0), w }
}

const staticLayers = (
  <>
    <rect width={WIDTH} height={HEIGHT} className="map-sea" />

    {geometry.countryLabels.map((label) => {
      const [x, y] = project(label.lat, label.lon)
      return (
        <text key={label.name} x={x} y={y} className="map-country">
          {label.name}
        </text>
      )
    })}

    <path d={borderPath} transform="translate(9 11)" className="map-shadow" />
    <path d={borderPath} className="map-land" />

    <g className="map-roads">
      {roadPaths.map((path) => (
        <g key={path}>
          <path d={path} className="road-casing" />
          <path d={path} className="road-fill" />
        </g>
      ))}
    </g>

    <g className="map-lakes">
      {geometry.lakes.map((lake) => (
        <path key={lake.name} d={toPath(lake.points)} className="map-lake" />
      ))}
    </g>

    <g className="map-cities">
      {geometry.cities.map((city) => {
        const [x, y] = project(city.lat, city.lon)
        const start = city.anchor === 'start'
        return (
          <g key={city.id}>
            <circle cx={x} cy={y} r="6.5" className="city-dot" />
            <text x={start ? x + 11 : x - 11} y={y + 3.5} textAnchor={start ? 'start' : 'end'} className="city-label">
              {city.name.toUpperCase()}
            </text>
          </g>
        )
      })}
    </g>
  </>
)

export default function SwissMap({ courses, selectedId, playedIds, onSelect, resetKey = 0, focusOffset = 0 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [view, setView] = useState<View | null>(null)
  const [userPosition, setUserPosition] = useState<Point | undefined>()
  const [notice, setNotice] = useState('')

  const aspect = size.width && size.height ? size.width / size.height : WIDTH / HEIGHT
  const current = view ?? initialView(aspect)
  const viewRef = useRef(current)
  const sizeRef = useRef(size)
  useEffect(() => {
    viewRef.current = current
    sizeRef.current = size
  })

  const height = current.w / aspect
  const pxPerUnit = size.width ? size.width / current.w : 1
  const flagScale = clamp(1 / pxPerUnit, 0.5, 2.5)
  const labelScale = clamp(1 / pxPerUnit, 1, 2.5)
  const showLabels = pxPerUnit >= 0.75

  const applyView = useCallback((next: View) => {
    const { width, height: h } = sizeRef.current
    const ratio = width && h ? width / h : WIDTH / HEIGHT
    const w = clamp(next.w, WIDTH / MAX_ZOOM, fitWidth(ratio) * 1.1)
    const result = { w, cx: clamp(next.cx, 0, WIDTH), cy: clamp(next.cy, 0, HEIGHT) }
    viewRef.current = result
    setView(result)
  }, [])

  const zoomAt = useCallback(
    (factor: number, sx: number, sy: number) => {
      const { width, height: h } = sizeRef.current
      if (!width || !h) return
      const v = viewRef.current
      const unitsPerPx = v.w / width
      const ux = v.cx - v.w / 2 + sx * unitsPerPx
      const uy = v.cy - (h * unitsPerPx) / 2 + sy * unitsPerPx
      const w = clamp(v.w * factor, WIDTH / MAX_ZOOM, fitWidth(width / h) * 1.1)
      const nextUnitsPerPx = w / width
      applyView({ w, cx: ux - sx * nextUnitsPerPx + w / 2, cy: uy - sy * nextUnitsPerPx + (h * nextUnitsPerPx) / 2 })
    },
    [applyView],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const { width } = sizeRef.current
      if (!width) return
      const v = viewRef.current
      const unitsPerPx = v.w / width
      applyView({ ...v, cx: v.cx - dx * unitsPerPx, cy: v.cy - dy * unitsPerPx })
    },
    [applyView],
  )

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(Math.exp(event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const [appliedResetKey, setAppliedResetKey] = useState(resetKey)
  if (appliedResetKey !== resetKey) {
    setAppliedResetKey(resetKey)
    setView(null)
  }

  useEffect(() => {
    if (!selectedId) return
    const course = courses.find((item) => item.id === selectedId)
    if (!course) return
    const { width, height: h } = sizeRef.current
    const ratio = width && h ? width / h : WIDTH / HEIGHT
    const w = Math.min(viewRef.current.w, WIDTH / 2.5)
    const [x, y] = project(course.latitude, course.longitude)
    applyView({ w, cx: x, cy: y + (w / ratio) * focusOffset })
  }, [selectedId, courses, focusOffset, applyView])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef({ dragging: false, startX: 0, startY: 0, pinchDistance: 0 })

  const localPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = localPoint(event)
    pointers.current.set(event.pointerId, point)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = { dragging: true, startX: 0, startY: 0, pinchDistance: Math.hypot(a[0] - b[0], a[1] - b[1]) }
      event.currentTarget.setPointerCapture(event.pointerId)
    } else {
      gesture.current = { dragging: false, startX: point[0], startY: point[1], pinchDistance: 0 }
    }
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const point = localPoint(event)
    pointers.current.set(event.pointerId, point)
    const state = gesture.current

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1])
      if (state.pinchDistance && distance) {
        zoomAt(state.pinchDistance / distance, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      }
      panBy((point[0] - previous[0]) / 2, (point[1] - previous[1]) / 2)
      state.pinchDistance = distance
      return
    }

    if (!state.dragging && Math.hypot(point[0] - state.startX, point[1] - state.startY) > 6) {
      state.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (state.dragging) panBy(point[0] - previous[0], point[1] - previous[1])
  }

  const onPointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    gesture.current.pinchDistance = 0
    if (pointers.current.size === 0) gesture.current.dragging = false
  }

  const zoomBy = (factor: number) => zoomAt(factor, size.width / 2, size.height / 2)

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice('Standortbestimmung wird nicht unterstützt.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = project(coords.latitude, coords.longitude)
        if (position[0] < 0 || position[0] > WIDTH || position[1] < 0 || position[1] > HEIGHT) {
          setNotice('Dein Standort liegt ausserhalb der Karte.')
          return
        }
        setUserPosition(position)
        applyView({ w: Math.min(viewRef.current.w, WIDTH / 3), cx: position[0], cy: position[1] })
      },
      () => setNotice('Standort konnte nicht ermittelt werden.'),
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  const flags = useMemo(
    () =>
      courses
        .map((course) => ({ course, position: project(course.latitude, course.longitude) }))
        .sort((a, b) => a.position[1] - b.position[1]),
    [courses],
  )

  return (
    <>
      <svg
        ref={svgRef}
        className="swiss-map"
        style={{ '--ls': labelScale } as CSSProperties}
        viewBox={`${current.cx - current.w / 2} ${current.cy - height / 2} ${current.w} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Stilisierte Karte der Schweiz mit Golfplätzen"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {staticLayers}

        {userPosition && (
          <g transform={`translate(${userPosition[0]} ${userPosition[1]}) scale(${flagScale})`} className="user-dot">
            <circle r="14" className="user-halo" />
            <circle r="6" className="user-core" />
          </g>
        )}

        <g className="map-flags">
          {flags.map(({ course, position: [x, y] }) => {
            const selected = course.id === selectedId
            const played = playedIds.has(course.id)
            const size = (selected ? 1.35 : 1) * flagScale
            return (
              <g
                key={course.id}
                className={`course-flag${selected ? ' selected' : ''}${played ? ' played' : ''}`}
                transform={`translate(${x} ${y}) scale(${size})`}
                tabIndex={0}
                role="button"
                aria-label={`${course.name}${played ? ' (gespielt)' : ''}`}
                onClick={() => onSelect(course.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(course.id)
                  }
                }}
              >
                <title>{course.name}</title>
                <rect x="-22" y="-38" width="44" height="44" className="flag-hit" />
                <ellipse cx="0" cy="0" rx="4.5" ry="2" className="flag-base" />
                <line x1="0" y1="0" x2="0" y2="-26" className="flag-pole" />
                <path d="M0 -26 L-13 -22 L0 -17Z" className="flag-cloth" />
                {(showLabels || selected) && (
                  <text
                    x={course.labelAnchor === 'end' ? -8 : 8}
                    y={3 + (course.labelDy ?? 0)}
                    textAnchor={course.labelAnchor ?? 'start'}
                    className="flag-label"
                  >
                    {course.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="map-controls">
        <button type="button" className="map-control" aria-label="Vergrössern" onClick={() => zoomBy(1 / 1.6)}>+</button>
        <button type="button" className="map-control" aria-label="Verkleinern" onClick={() => zoomBy(1.6)}>−</button>
        <button type="button" className="map-control" aria-label="Mein Standort" onClick={locate}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>
      <div className="map-notice" role="status" aria-live="polite">{notice}</div>
    </>
  )
}
