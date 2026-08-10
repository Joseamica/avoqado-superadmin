import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import {
  fetchMasterCatalogOrganization,
  fetchMasterCatalogOrganizations,
  updateMasterCatalogConfig,
  updateMasterCatalogEntitlement,
  updateMasterCatalogGovernance,
  updateMasterCatalogModule,
} from './api'

const baseURL = 'http://localhost:3000/api/v1'
const seen: { method: string; pathname: string; body: unknown }[] = []
const envelope = (after: unknown, before: unknown = null) =>
  HttpResponse.json({ success: true, data: { before, after } })

const server = setupServer(
  http.get(`${baseURL}/superadmin/master-catalog/organizations`, ({ request }) => {
    const url = new URL(request.url)
    seen.push({ method: 'GET', pathname: url.pathname, body: Object.fromEntries(url.searchParams) })
    return HttpResponse.json({
      success: true,
      data: {
        items: [{ id: 'org-1', name: 'PITS', slug: 'pits', _count: { venues: 2 } }],
        nextCursor: null,
      },
    })
  }),
  http.get(`${baseURL}/superadmin/master-catalog/organizations/:organizationId`, ({ request }) => {
    seen.push({ method: 'GET', pathname: new URL(request.url).pathname, body: null })
    return HttpResponse.json({
      success: true,
      data: {
        organization: { id: 'org-1', name: 'PITS', slug: 'pits' },
        entitlement: null,
        module: null,
        access: {
          organizationId: 'org-1',
          orgRole: null,
          entitlementActive: false,
          moduleActive: false,
          config: null,
          reasonCode: 'ENTITLEMENT_MISSING',
          canRead: false,
          canMutateContent: false,
          canConfigureControlPlane: true,
        },
        venues: [],
      },
    })
  }),
  http.put(
    `${baseURL}/superadmin/master-catalog/organizations/:organizationId/entitlement`,
    async ({ request }) => {
      seen.push({
        method: 'PUT',
        pathname: new URL(request.url).pathname,
        body: await request.json(),
      })
      return envelope({ status: 'ACTIVE' }, { status: 'REVOKED' })
    },
  ),
  http.put(
    `${baseURL}/superadmin/master-catalog/organizations/:organizationId/module`,
    async ({ request }) => {
      seen.push({
        method: 'PUT',
        pathname: new URL(request.url).pathname,
        body: await request.json(),
      })
      return envelope({ enabled: true }, { enabled: false })
    },
  ),
  http.put(
    `${baseURL}/superadmin/master-catalog/organizations/:organizationId/config`,
    async ({ request }) => {
      seen.push({
        method: 'PUT',
        pathname: new URL(request.url).pathname,
        body: await request.json(),
      })
      return envelope(
        { schemaVersion: 1, catalogCoreEnabled: true },
        { schemaVersion: 1, catalogCoreEnabled: false },
      )
    },
  ),
  http.put(
    `${baseURL}/superadmin/master-catalog/organizations/:organizationId/venues/:venueId/governance`,
    async ({ request }) => {
      seen.push({
        method: 'PUT',
        pathname: new URL(request.url).pathname,
        body: await request.json(),
      })
      return envelope({ governanceState: 'ENFORCED' }, { governanceState: 'READY_TO_ENFORCE' })
    },
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  seen.length = 0
})
afterAll(() => server.close())

describe('master catalog control-plane API', () => {
  it('uses only the dedicated /superadmin namespace and unwraps the read envelopes', async () => {
    const list = await fetchMasterCatalogOrganizations({ pageSize: 25 })
    const detail = await fetchMasterCatalogOrganization('org-1')

    expect(list.items[0]).toMatchObject({ id: 'org-1', name: 'PITS' })
    expect(detail.organization.name).toBe('PITS')
    expect(seen).toEqual([
      {
        method: 'GET',
        pathname: '/api/v1/superadmin/master-catalog/organizations',
        body: { pageSize: '25' },
      },
      {
        method: 'GET',
        pathname: '/api/v1/superadmin/master-catalog/organizations/org-1',
        body: null,
      },
    ])
  })

  it('sends only closed control-plane writes and preserves server before/after', async () => {
    const config = {
      schemaVersion: 1 as const,
      catalogCoreEnabled: true,
      identifiersEnabled: false,
      regionalPricingEnabled: false,
      governanceMode: 'ADVISORY' as const,
    }
    const entitlement = await updateMasterCatalogEntitlement('org-1', {
      status: 'ACTIVE',
      source: 'CONTRACT',
      reason: 'Contrato vigente',
      startsAt: '2026-08-10T00:00:00.000Z',
      endsAt: null,
    })
    const module = await updateMasterCatalogModule('org-1', { enabled: true })
    const configResult = await updateMasterCatalogConfig('org-1', { config })
    const governance = await updateMasterCatalogGovernance('org-1', 'venue-1', {
      governanceState: 'ENFORCED',
    })

    expect(entitlement).toEqual({ before: { status: 'REVOKED' }, after: { status: 'ACTIVE' } })
    expect(module.after).toEqual({ enabled: true })
    expect(configResult.before).toEqual({ schemaVersion: 1, catalogCoreEnabled: false })
    expect(governance.after).toEqual({ governanceState: 'ENFORCED' })
    expect(seen.map((request) => request.pathname)).toEqual([
      '/api/v1/superadmin/master-catalog/organizations/org-1/entitlement',
      '/api/v1/superadmin/master-catalog/organizations/org-1/module',
      '/api/v1/superadmin/master-catalog/organizations/org-1/config',
      '/api/v1/superadmin/master-catalog/organizations/org-1/venues/venue-1/governance',
    ])
    expect(seen.every((request) => !request.pathname.includes('/dashboard/'))).toBe(true)
    expect(seen[1]?.body).toEqual({ enabled: true })
    expect(seen[2]?.body).toEqual({ config })
    expect(seen[3]?.body).toEqual({ governanceState: 'ENFORCED' })
  })

  it('fails closed when the server exposes an unknown config version', async () => {
    server.use(
      http.get(`${baseURL}/superadmin/master-catalog/organizations/:organizationId`, () =>
        HttpResponse.json({
          success: true,
          data: {
            organization: { id: 'org-1', name: 'PITS', slug: 'pits' },
            entitlement: null,
            module: null,
            access: {
              organizationId: 'org-1',
              config: {
                schemaVersion: 2,
                catalogCoreEnabled: true,
                identifiersEnabled: true,
                regionalPricingEnabled: true,
                governanceMode: 'ENFORCED',
              },
              reasonCode: 'ACCESSIBLE',
              canConfigureControlPlane: true,
            },
            venues: [],
          },
        }),
      ),
    )

    const detail = await fetchMasterCatalogOrganization('org-1')

    expect(detail.access.config).toBeNull()
    expect(detail.access.reasonCode).toBe('CONFIG_INVALID')
  })
})
