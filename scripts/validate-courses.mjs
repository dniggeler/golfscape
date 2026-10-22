import { readFile } from 'node:fs/promises'

const courses = JSON.parse(await readFile(new URL('../src/data/golf-courses.json', import.meta.url), 'utf8'))
const requiredFields = ['id', 'name', 'city', 'region', 'country', 'countryCode', 'sourceUrl']
const errors = []
const ids = new Set()

if (!Array.isArray(courses) || courses.length === 0) {
  errors.push('The course data must be a non-empty JSON array.')
} else {
  for (const [index, course] of courses.entries()) {
    const label = `Course at index ${index}`
    for (const field of requiredFields) {
      if (typeof course[field] !== 'string' || !course[field].trim()) {
        errors.push(`${label} is missing a non-empty "${field}".`)
      }
    }

    if (ids.has(course.id)) errors.push(`Duplicate course id "${course.id}".`)
    ids.add(course.id)

    if (typeof course.latitude !== 'number' || !Number.isFinite(course.latitude) || course.latitude < -90 || course.latitude > 90) {
      errors.push(`${label} has an invalid latitude.`)
    }
    if (typeof course.longitude !== 'number' || !Number.isFinite(course.longitude) || course.longitude < -180 || course.longitude > 180) {
      errors.push(`${label} has an invalid longitude.`)
    }
    if (course.holes !== undefined && (!Number.isInteger(course.holes) || course.holes <= 0)) {
      errors.push(`${label} has an invalid hole count.`)
    }
    if (course.image && (!course.image.url || !course.image.attribution || !course.image.license || !course.image.sourceUrl)) {
      errors.push(`${label} has image information without complete attribution and licensing details.`)
    }
    if (course.website && !URL.canParse(course.website)) errors.push(`${label} has an invalid website URL.`)
    if (course.sourceUrl && !URL.canParse(course.sourceUrl)) errors.push(`${label} has an invalid source URL.`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${courses.length} golf course records.`)
}
