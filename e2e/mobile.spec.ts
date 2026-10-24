import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.swiss-map')).toBeVisible()
})

test('page does not scroll or overflow', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
  )
  expect(overflow).toBe(false)
})

test('interactive controls are at least 44px', async ({ page }) => {
  const selectors = ['.map-control', '.map-button', '.filter-chip', '.search-box']
  for (const selector of selectors) {
    for (const el of await page.locator(selector).all()) {
      const box = await el.boundingBox()
      expect(box?.height ?? 0, selector).toBeGreaterThanOrEqual(44)
    }
  }
})

test('search input does not trigger iOS zoom', async ({ page }) => {
  const size = await page.locator('.search-box input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(16)
})

test('list sheet opens and selecting a course shows the detail sheet', async ({ page }) => {
  await page.locator('.sheet-handle').first().click()
  await expect(page.locator('.sidebar')).toHaveClass(/sheet-half/)

  await page.locator('.course-card').first().click()
  const detail = page.locator('.detail-panel')
  await expect(detail).toBeVisible()
  await detail.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)))
  const box = await detail.boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1)

  await page.locator('.detail-close').click()
  await expect(detail).toBeHidden()
})

test('multiple courses can be marked as played in one dialog', async ({ page }) => {
  await page.locator('.sheet-handle').first().click()
  await page.locator('.manage-played').click()
  const dialog = page.getByRole('dialog', { name: 'Gespielte Plätze' })
  await expect(dialog).toBeVisible()

  const rows = dialog.locator('.played-row input')
  await rows.nth(0).check()
  await rows.nth(1).check()
  await expect(page.locator('.manage-played')).toHaveText('Gespielt (2)')

  await dialog.getByPlaceholder('Platz, Ort oder Region suchen').fill('Migros')
  await dialog.getByRole('button', { name: /Alle auswählen/ }).click()
  await dialog.getByRole('button', { name: /Alle abwählen/ }).click()
  await dialog.getByRole('button', { name: 'Fertig' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.manage-played')).toHaveText('Gespielt (2)')

  await page.reload()
  await expect(page.locator('.map-legend')).toContainText('Gespielt (2)')
})

test('zoom button changes the map viewBox', async ({ page }) => {
  const before = await page.locator('.swiss-map').getAttribute('viewBox')
  await page.getByRole('button', { name: 'Vergrössern' }).click()
  await expect.poll(() => page.locator('.swiss-map').getAttribute('viewBox')).not.toBe(before)
})
