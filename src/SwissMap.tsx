import { useMemo } from 'react'
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
}

type Point = [number, number]

const WIDTH = 1100
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

export default function SwissMap({ courses, selectedId, playedIds, onSelect }: Props) {
  const flags = useMemo(
    () =>
      courses
        .map((course) => ({ course, position: project(course.latitude, course.longitude) }))
        .sort((a, b) => a.position[1] - b.position[1]),
    [courses],
  )

  return (
    <svg
      className="swiss-map"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Stilisierte Karte der Schweiz mit Golfplätzen"
    >
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

      <g className="map-flags">
        {flags.map(({ course, position: [x, y] }) => {
          const selected = course.id === selectedId
          const played = playedIds.has(course.id)
          const size = selected ? 1.35 : 1
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
              <rect x="-14" y="-34" width="34" height="38" className="flag-hit" />
              <ellipse cx="0" cy="0" rx="4.5" ry="2" className="flag-base" />
              <line x1="0" y1="0" x2="0" y2="-26" className="flag-pole" />
              <path d="M0 -26 L-13 -22 L0 -17Z" className="flag-cloth" />
              <text
                x={course.labelAnchor === 'end' ? -8 : 8}
                y={3 + (course.labelDy ?? 0)}
                textAnchor={course.labelAnchor ?? 'start'}
                className="flag-label"
              >
                {course.name}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
