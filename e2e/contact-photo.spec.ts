import { test, expect, type Page, type Locator } from '@playwright/test'
import path from 'node:path'

/**
 * Photo upload, circular avatar, and the initials fallback.
 *
 * Runs against the real Contacts API, so each test invents its own contact and
 * deletes it through the API afterwards. Screenshots land in `screenshots/`,
 * because "does this actually look like a circle?" is not something an
 * assertion answers on its own.
 */

const FIXTURES = path.join(__dirname, 'fixtures')
const SHOTS = path.join(__dirname, '..', 'screenshots')
const API = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000'

const fixture = (name: string) => path.join(FIXTURES, name)

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

/** The detail URL ends in the new contact's id. */
function contactIdFrom(url: string): number {
  const match = /\/contacts\/(\d+)/.exec(url)
  if (!match) throw new Error(`no contact id in ${url}`)
  return Number(match[1])
}

/**
 * Clean up through the API, not the table. Deleting via the UI is ambiguous
 * once two test contacts share a name, and one failed run would otherwise
 * leave rows that break every run after it.
 */
async function deleteContact(page: Page, id: number) {
  await page.request.delete(`${API}/api/v1/contacts/${id}`)
}

async function createContact(
  page: Page,
  fields: { first: string; last: string; email: string; photo?: string },
): Promise<number> {
  await page.goto('/contacts/new')
  await page.getByLabel('First name').fill(fields.first)
  await page.getByLabel('Last name').fill(fields.last)
  await page.getByLabel('Email', { exact: false }).first().fill(fields.email)
  if (fields.photo) {
    await page.setInputFiles('input[type="file"]', fixture(fields.photo))
    await expect(page.getByAltText(/profile photo preview/i)).toBeVisible()
  }
  await page.getByRole('button', { name: /create contact/i }).click()

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: `${fields.first} ${fields.last}`,
    }),
  ).toBeVisible()

  return contactIdFrom(page.url())
}

/**
 * The geometry that makes an avatar read as a profile picture: square box,
 * fully rounded corners, and a cover fit so the image crops instead of squashing.
 */
async function expectCircular(avatar: Locator) {
  await expect(avatar).toBeVisible()

  const box = await avatar.boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1)

  const style = await avatar.evaluate((el) => {
    const computed = getComputedStyle(el)
    return {
      radius: parseFloat(computed.borderTopLeftRadius),
      objectFit: computed.objectFit,
    }
  })

  // Radius below half the width would be a rounded square, not a circle.
  expect(style.radius).toBeGreaterThanOrEqual(box!.width / 2 - 1)
  expect(style.objectFit).toBe('cover')
}

test.describe('contact photo', () => {
  test('uploads a photo and shows it as a circular avatar', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill('Lovelace')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('photo'))

    await page.setInputFiles('input[type="file"]', fixture('avatar.png'))
    await expect(page.getByAltText(/profile photo preview/i)).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/01-form-with-preview.png`, fullPage: true })

    await page.getByRole('button', { name: /create contact/i }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ada Lovelace' }),
    ).toBeVisible()
    const id = contactIdFrom(page.url())

    const avatar = page.locator('img[src^="data:image"]').first()
    await expectCircular(avatar)

    await page.screenshot({ path: `${SHOTS}/02-detail-circular-avatar.png`, fullPage: true })
    await avatar.screenshot({ path: `${SHOTS}/03-avatar-closeup.png` })

    await deleteContact(page, id)
  })

  test('falls back to initials when there is no photo', async ({ page }) => {
    const id = await createContact(page, {
      first: 'Grace',
      last: 'Hopper',
      email: uniqueEmail('initials'),
    })

    await expect(page.locator('img[src^="data:image"]')).toHaveCount(0)
    await expect(page.getByText('GH').first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/04-initials-fallback.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('keeps the photo when only the name is edited', async ({ page }) => {
    // The trap: saving is a full replace (PUT), so a photo not carried through
    // the edit form is silently wiped.
    const id = await createContact(page, {
      first: 'Alan',
      last: 'Turing',
      email: uniqueEmail('preserve'),
      photo: 'avatar.png',
    })

    await page.goto(`/contacts/${id}/edit`)
    await expect(page.getByAltText(/profile photo preview/i)).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/05-edit-form-photo-carried.png`, fullPage: true })

    await page.getByLabel('First name').fill('Alan M')
    await page.getByRole('button', { name: /save|update/i }).first().click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Alan M Turing' }),
    ).toBeVisible()
    await expectCircular(page.locator('img[src^="data:image"]').first())
    await page.screenshot({ path: `${SHOTS}/06-photo-survived-edit.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('shows avatars in the contacts list', async ({ page }) => {
    const id = await createContact(page, {
      first: 'Katherine',
      last: 'Johnson',
      email: uniqueEmail('list'),
      photo: 'avatar.png',
    })

    await page.goto('/contacts')
    await expectCircular(page.locator('img[src^="data:image"]').first())
    await page.screenshot({ path: `${SHOTS}/07-list-with-avatars.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('removing the photo falls back to initials', async ({ page }) => {
    const id = await createContact(page, {
      first: 'Radia',
      last: 'Perlman',
      email: uniqueEmail('remove'),
      photo: 'avatar.png',
    })

    await page.goto(`/contacts/${id}/edit`)
    await page.getByRole('button', { name: /remove/i }).click()
    await page.getByRole('button', { name: /save|update/i }).first().click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Radia Perlman' }),
    ).toBeVisible()
    await expect(page.locator('img[src^="data:image"]')).toHaveCount(0)
    await expect(page.getByText('RP').first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/09-photo-removed-initials.png`, fullPage: true })

    await deleteContact(page, id)
  })
})

/**
 * Shape matrix. Every one of these must come out as the same circle — a
 * 30:1 banner and a 1x1 pixel included. This is where `object-cover` and
 * `aspect-square` earn their place: without them the wide images render as
 * squashed ellipses.
 */
test.describe('photo shapes', () => {
  const SHAPES = [
    { file: 'tiny.png', label: '1x1 pixel' },
    { file: 'small.png', label: '16x16, smaller than the avatar' },
    { file: 'large.png', label: '2000x2000' },
    { file: 'landscape.png', label: '480x160 landscape' },
    { file: 'portrait.png', label: '160x480 portrait' },
    { file: 'ultrawide.png', label: '1200x40 ultrawide' },
    { file: 'pixel.gif', label: 'GIF' },
  ]

  for (const shape of SHAPES) {
    test(`renders ${shape.label} as a circle`, async ({ page }) => {
      const slug = shape.file.replace(/\W+/g, '-')
      const id = await createContact(page, {
        first: 'Shape',
        last: 'Test',
        email: uniqueEmail(`shape-${slug}`),
        photo: shape.file,
      })

      const avatar = page.locator('img[src^="data:image"]').first()
      await expectCircular(avatar)
      await avatar.screenshot({ path: `${SHOTS}/shape-${slug}.png` })

      await deleteContact(page, id)
    })
  }
})

test.describe('photo rejections', () => {
  test('rejects a file over the 2 MB limit', async ({ page }) => {
    await page.goto('/contacts/new')

    await page.setInputFiles('input[type="file"]', {
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(3 * 1024 * 1024),
    })

    // Scoped to the field's own alert — Next's route announcer is also role=alert.
    await expect(page.locator('p[role="alert"]')).toContainText(/2 MB/i)
    await expect(page.getByAltText(/profile photo preview/i)).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/08-oversized-rejected.png`, fullPage: true })
  })

  test('rejects an SVG, which can carry script', async ({ page }) => {
    await page.goto('/contacts/new')

    await page.setInputFiles('input[type="file"]', {
      name: 'evil.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),
    })

    await expect(page.locator('p[role="alert"]')).toBeVisible()
    await expect(page.getByAltText(/profile photo preview/i)).toHaveCount(0)
  })

  test('rejects a text file renamed to .png', async ({ page }) => {
    // The browser reports the real MIME type, so the name must not be trusted.
    await page.goto('/contacts/new')

    await page.setInputFiles('input[type="file"]', {
      name: 'not-an-image.png',
      mimeType: 'text/plain',
      buffer: Buffer.from('this is plain text, not a PNG'),
    })

    await expect(page.locator('p[role="alert"]')).toBeVisible()
  })

  test('keeps an existing photo when a bad file is picked', async ({ page }) => {
    const id = await createContact(page, {
      first: 'Barbara',
      last: 'Liskov',
      email: uniqueEmail('badpick'),
      photo: 'avatar.png',
    })

    await page.goto(`/contacts/${id}/edit`)
    await page.setInputFiles('input[type="file"]', {
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(3 * 1024 * 1024),
    })

    await expect(page.locator('p[role="alert"]')).toBeVisible()
    // The good photo must still be there, not silently dropped.
    await expect(page.getByAltText(/profile photo preview/i)).toBeVisible()

    await deleteContact(page, id)
  })
})

test.describe('initials fallback', () => {
  const NAMES = [
    { first: 'Ada', last: 'Lovelace', expected: 'AL', label: 'plain ASCII' },
    { first: 'Ада', last: 'Лавлейс', expected: 'АЛ', label: 'Cyrillic' },
    { first: '愛', last: '田', expected: '愛田', label: 'CJK' },
    { first: '🎉', last: 'Party', expected: '🎉P', label: 'emoji' },
    { first: 'é', last: 'Smith', expected: 'ÉS', label: 'combining accent' },
  ]

  for (const name of NAMES) {
    test(`shows ${name.label} initials without a photo`, async ({ page }) => {
      const slug = name.label.replace(/\W+/g, '-')
      const id = await createContact(page, {
        first: name.first,
        last: name.last,
        email: uniqueEmail(`init-${slug}`),
      })

      await expect(page.locator('img[src^="data:image"]')).toHaveCount(0)
      await expect(page.getByText(name.expected).first()).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/initials-${slug}.png` })

      await deleteContact(page, id)
    })
  }
})
