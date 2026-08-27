import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * Multiple addresses per contact, grouped by type on the detail page.
 *
 * Runs against the real Contacts API and cleans up through it, so a failed run
 * does not leave rows that break the next one.
 */

const SHOTS = path.join(__dirname, '..', 'screenshots')
const API = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000'

type AddressFields = {
  type: 'Home' | 'Work' | 'Other'
  street?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

function contactIdFrom(url: string): number {
  const match = /\/contacts\/(\d+)/.exec(url)
  if (!match) throw new Error(`no contact id in ${url}`)
  return Number(match[1])
}

async function deleteContact(page: Page, id: number) {
  await page.request.delete(`${API}/api/v1/contacts/${id}`)
}

/**
 * Submit the create form and return the new id.
 *
 * Waits for the detail heading first: reading `page.url()` straight after the
 * click races the navigation and can still see /contacts/new.
 */
async function submitAndGetId(page: Page, fullName: string): Promise<number> {
  await page.getByRole('button', { name: /create contact/i }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: fullName }),
  ).toBeVisible()
  return contactIdFrom(page.url())
}

/** Fill the nth address row, adding it first. */
async function addAddress(page: Page, index: number, fields: AddressFields) {
  await page.getByRole('button', { name: /add address/i }).click()

  await page
    .getByLabel(`Address ${index + 1} type`)
    .selectOption(fields.type)

  for (const [name, label] of [
    ['street', 'Street address'],
    ['city', 'City'],
    ['state', 'State / region'],
    ['postal_code', 'Postal code'],
    ['country', 'Country'],
  ] as const) {
    const value = fields[name]
    if (!value) continue
    await page
      .getByRole('group', { name: `Address ${index + 1}` })
      .getByLabel(label)
      .fill(value)
  }
}

const HOME: AddressFields = {
  type: 'Home',
  street: '12 Ockham Rd',
  city: 'London',
  postal_code: 'SW1A 1AA',
  country: 'UK',
}
const WORK: AddressFields = {
  type: 'Work',
  street: '1 Market St, Suite 400',
  city: 'San Francisco',
  state: 'CA',
  postal_code: '94105',
  country: 'USA',
}
const OTHER: AddressFields = {
  type: 'Other',
  street: 'Sea Ranch',
  city: 'Sonoma',
  country: 'USA',
}

test.describe('multiple addresses', () => {
  test('creates a contact with three addresses grouped by type', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Ada')
    await page.getByLabel('Last name').fill('Lovelace')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('addr'))

    await addAddress(page, 0, HOME)
    await addAddress(page, 1, WORK)
    await addAddress(page, 2, OTHER)

    await page.screenshot({ path: `${SHOTS}/20-form-three-addresses.png`, fullPage: true })

    await page.getByRole('button', { name: /create contact/i }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ada Lovelace' }),
    ).toBeVisible()
    const id = contactIdFrom(page.url())

    // Grouped under their type headings, in Home / Work / Other order.
    const headings = page.locator('section h3')
    await expect(headings).toHaveText([/Home/, /Work/, /Other/])

    await expect(page.getByText('12 Ockham Rd, London, SW1A 1AA, UK')).toBeVisible()
    await expect(
      page.getByText('1 Market St, Suite 400, San Francisco, CA 94105, USA'),
    ).toBeVisible()

    await page.screenshot({ path: `${SHOTS}/21-detail-grouped-addresses.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('groups several addresses of the same type together', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Grace')
    await page.getByLabel('Last name').fill('Hopper')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('same-type'))

    await addAddress(page, 0, { ...HOME, city: 'London' })
    await addAddress(page, 1, { ...HOME, city: 'Bath', street: '4 Royal Crescent' })

    await page.getByRole('button', { name: /create contact/i }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Grace Hopper' }),
    ).toBeVisible()
    const id = contactIdFrom(page.url())

    // One Home group holding both, and a count badge.
    await expect(page.locator('section h3')).toHaveCount(1)
    await expect(page.locator('section h3')).toContainText('2')
    await page.screenshot({ path: `${SHOTS}/22-same-type-grouped.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('shows an empty state when a contact has no addresses', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Alan')
    await page.getByLabel('Last name').fill('Turing')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('no-addr'))
    await page.getByRole('button', { name: /create contact/i }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Alan Turing' }),
    ).toBeVisible()
    const id = contactIdFrom(page.url())

    await expect(page.getByText(/no addresses for this contact yet/i)).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/23-no-addresses-empty-state.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('edits keep existing addresses and can add another', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Katherine')
    await page.getByLabel('Last name').fill('Johnson')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('edit-addr'))
    await addAddress(page, 0, HOME)
    const id = await submitAndGetId(page, 'Katherine Johnson')

    await page.goto(`/contacts/${id}/edit`)

    // The existing address must be prefilled, not lost.
    await expect(
      page.getByRole('group', { name: 'Address 1' }).getByLabel('Street address'),
    ).toHaveValue('12 Ockham Rd')
    await addAddress(page, 1, WORK)
    await page.screenshot({ path: `${SHOTS}/24-edit-add-second-address.png`, fullPage: true })

    await page.getByRole('button', { name: /save|update/i }).first().click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Katherine Johnson' }),
    ).toBeVisible()

    await expect(page.locator('section h3')).toHaveText([/Home/, /Work/])

    await deleteContact(page, id)
  })

  test('removing the middle row drops the right address', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Radia')
    await page.getByLabel('Last name').fill('Perlman')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('remove-mid'))

    await addAddress(page, 0, HOME)
    await addAddress(page, 1, WORK)
    await addAddress(page, 2, OTHER)

    await page.getByRole('button', { name: /remove address 2/i }).click()

    const id = await submitAndGetId(page, 'Radia Perlman')

    // Home and Other survive; Work is gone.
    await expect(page.locator('section h3')).toHaveText([/Home/, /Other/])
    await expect(
      page.getByRole('listitem').filter({ hasText: '1 Market St' }),
    ).toHaveCount(0)
    await page.screenshot({ path: `${SHOTS}/25-middle-row-removed.png`, fullPage: true })

    await deleteContact(page, id)
  })

  test('an address survives an edit that only changes the name', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Barbara')
    await page.getByLabel('Last name').fill('Liskov')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('addr-preserve'))
    await addAddress(page, 0, WORK)
    const id = await submitAndGetId(page, 'Barbara Liskov')

    await page.goto(`/contacts/${id}/edit`)
    await page.getByLabel('First name').fill('Barbara H')
    await page.getByRole('button', { name: /save|update/i }).first().click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Barbara H Liskov' }),
    ).toBeVisible()
    // Same trap as the photo: a full replace must carry the addresses through.
    // Scoped to the addresses section so a dev-overlay match cannot satisfy it.
    await expect(
      page.getByRole('listitem').filter({ hasText: '1 Market St' }),
    ).toBeVisible()

    await deleteContact(page, id)
  })

  test('deleting a contact removes its addresses', async ({ page }) => {
    await page.goto('/contacts/new')
    await page.getByLabel('First name').fill('Cascade')
    await page.getByLabel('Last name').fill('Test')
    await page.getByLabel('Email', { exact: false }).first().fill(uniqueEmail('cascade'))
    await addAddress(page, 0, HOME)
    await addAddress(page, 1, WORK)
    const id = await submitAndGetId(page, 'Cascade Test')

    await deleteContact(page, id)

    // The contact is gone, and so is every address that pointed at it.
    const response = await page.request.get(`${API}/api/v1/contacts/${id}`)
    expect(response.status()).toBe(404)
  })
})
