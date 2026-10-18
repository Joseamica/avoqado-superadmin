import { expect, test, type Page } from '@playwright/test'
import axe from 'axe-core'

const id = 'c123456789012345678901234'
const uploadUrl = `http://localhost:5173/documentos/${id}#token=${'a'.repeat(64)}`
const initialRequest = {
  id,
  provider: 'ANGELPAY',
  entityType: 'PERSONA_FISICA',
  businessName: 'Óptica Central',
  contactName: null,
  email: null,
  phone: null,
  status: 'DRAFT',
  expiresAt: '2099-10-31T12:00:00.000Z',
  submittedAt: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  submissionVersion: 0,
  notification: { onboarding: 'NONE', daniel: 'NONE', attempts: 0, nextAttemptAt: null },
}

test('admin recibe prospectos, comparte liga y gestiona archivos desde desktop y móvil', async ({
  page,
}) => {
  let current = { ...initialRequest }
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.pathname.endsWith('/dashboard/auth/status'))
      return route.fulfill({
        json: {
          authenticated: true,
          user: {
            id: 'ops',
            firstName: 'Operaciones',
            lastName: null,
            email: 'ops@example.test',
            role: 'SUPERADMIN',
            photoUrl: null,
            venues: [],
          },
        },
      })
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:5197',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'content-type',
        },
      })
    if (url.pathname.endsWith('/document-requests') && req.method() === 'GET')
      return route.fulfill({ json: { items: [current], total: 1, page: 1, pageSize: 25 } })
    if (url.pathname.endsWith('/document-requests') && req.method() === 'POST')
      return route.fulfill({
        status: 201,
        json: { request: { ...current, ...req.postDataJSON() }, uploadUrl },
      })
    if (url.pathname.endsWith('/download'))
      return route.fulfill({ json: { url: 'https://storage.example.test/private-document' } })
    if (url.pathname.endsWith('/renew')) {
      current = { ...current, status: 'DRAFT' }
      return route.fulfill({ json: { request: current, uploadUrl } })
    }
    if (url.pathname.endsWith('/revoke')) {
      current = { ...current, status: 'REVOKED' }
      return route.fulfill({ json: { request: current } })
    }
    if (url.pathname.endsWith(`/document-requests/${id}`))
      return route.fulfill({
        json: {
          request: current,
          documents: [
            {
              id: 'cfile123456789012345678901',
              key: 'csf',
              fileName: 'constancia.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 2048,
            },
          ],
        },
      })
    return route.fulfill({ status: 404, json: { message: 'Fixture inexistente' } })
  })
  await page.route('**/socket.io/**', (route) => route.abort())
  await page.route('https://storage.example.test/private-document', (route) =>
    route.fulfill({
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename=constancia.pdf' },
      body: '%PDF-1.4 fixture',
    }),
  )
  await page.goto('/document-requests')
  await expect(page.getByRole('heading', { name: 'Documentos de afiliación' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Óptica Central' })).toBeVisible()
  expect(await audit(page, 'main')).toEqual([])
  await page.screenshot({ path: '../admin-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Crear liga', exact: true }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('textbox', { name: 'Nombre del negocio' }).fill('Taller Norte')
  expect(await audit(page, '[role=dialog]')).toEqual([])
  await drawer.getByRole('button', { name: 'Generar liga', exact: true }).click()
  await expect(drawer.getByRole('textbox', { name: 'Liga de entrega' })).toHaveValue(uploadUrl)
  await expect(drawer.getByRole('link', { name: 'Compartir por WhatsApp' })).toHaveAttribute(
    'href',
    /wa\.me\/\?text=/,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '../admin-mobile-drawer.png', fullPage: true })
  await drawer.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('link', { name: 'Óptica Central' }).click()
  await expect(page.getByText('Contacto pendiente de envío')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descargar constancia.pdf' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar constancia.pdf' }).click()
  expect((await download).suggestedFilename()).toBe('constancia.pdf')
  await page.screenshot({ path: '../admin-mobile-detail.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(await audit(page, 'main')).toEqual([])
  await page.getByRole('button', { name: 'Renovar liga', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar renovación' }).click()
  await expect(page.getByRole('textbox', { name: 'Liga de entrega' })).toHaveValue(uploadUrl)
  await page.getByRole('button', { name: 'Revocar liga', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar revocación' }).click()
  await expect(page.getByText('Revocada', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Liga de entrega' })).toHaveCount(0)
})

async function audit(page: Page, selector: string) {
  await page.addScriptTag({ content: axe.source })
  return page.evaluate(async (scope) => {
    const engine = (window as unknown as { axe: typeof import('axe-core') }).axe
    const results = await engine.run(document.querySelector(scope)!, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    })
    return results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target),
    }))
  }, selector)
}
