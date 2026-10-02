import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HybridCampaignEditor } from './HybridCampaignEditor'
import type { HybridCampaign } from './hybrid-api'
beforeAll(() =>
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
)
afterAll(() => vi.unstubAllGlobals())
const save = vi.fn(),
  preview = vi.fn()
vi.mock('./hybrid-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hybrid-api')>()),
  saveHybridCampaign: (...args: unknown[]) => save(...args),
  previewHybridCampaign: (...args: unknown[]) => preview(...args),
  fetchHybridCatalog: async (query: { page: number }) => ({
    items: [
      { id: 'CFDI', featureCode: 'CFDI', name: 'Facturación', offering: 'CONFIGURABLE' },
      {
        id: 'LOYALTY_PROGRAM',
        featureCode: 'LOYALTY_PROGRAM',
        name: 'Lealtad',
        offering: 'CONFIGURABLE',
      },
    ],
    // 30 in the catalog: the picker can page (only two are drawn per page here).
    total: 30,
    page: query.page,
    pageSize: 25,
  }),
}))
const campaign: HybridCampaign = {
  id: 'campaign',
  code: 'ELEGIR',
  slug: 'a-eleccion',
  name: 'Paquete flexible',
  status: 'DRAFT',
  revision: 3,
  startsAt: '2026-10-01T06:00:00Z',
  endsAt: '2026-12-01T06:00:00Z',
  capacity: 80,
  reservedCount: 0,
  redeemedCount: 0,
  audience: 'ALL',
  eligibleOrganizationIds: [],
  listed: false,
  draftDefinition: {
    schemaVersion: 1,
    kind: 'CHOICE_BUNDLE',
    choiceCount: 2,
    eligibleFeatureCodes: ['CFDI', 'LOYALTY_PROGRAM'],
    terms: {
      currency: 'MXN',
      interval: 'MONTHLY',
      price: 469.9,
      taxIncluded: true,
      promotionCycles: 4,
      renewal: { kind: 'REPRICE', price: 699.9 },
    },
  },
}
function show(duplicate = false, value = campaign) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <HybridCampaignEditor
        campaign={value}
        duplicate={duplicate}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  )
}
describe('hybrid campaign authoring', () => {
  it('lets an operator schedule a campaign for future dates', async () => {
    const user = userEvent.setup()
    show(false, { ...campaign, startsAt: '2099-01-10T06:00:00Z', endsAt: '2099-01-20T06:00:00Z' })
    await user.click(screen.getByRole('button', { name: /Vigencia · Ciudad de México/ }))
    expect(screen.getByRole('button', { name: '21 enero 2099' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled()
  })
  it('does not approve edited terms when an older preview finishes late', async () => {
    let finish!: (value: unknown) => void
    preview.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('button', { name: 'Revisar oferta' }))
    await user.clear(screen.getByLabelText('Precio mensual con IVA'))
    await user.type(screen.getByLabelText('Precio mensual con IVA'), '555')
    finish({
      definitionHash: 'old',
      terms: campaign.draftDefinition.terms,
      selection: { valid: false, issues: [] },
      requirements: [],
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Revisar oferta' })).not.toBeDisabled(),
    )
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeDisabled()
  })
  it('edits quantity, total price and renewal from campaign data without a fixed three-for-250 template', async () => {
    show()
    expect(screen.getByLabelText('Cantidad a elegir')).toHaveValue(2)
    expect(screen.getByLabelText('Precio mensual con IVA')).toHaveValue(469.9)
    expect(screen.getByLabelText('Precio de renovación con IVA')).toHaveValue(699.9)
    expect(screen.getByLabelText('Ciclos de promoción')).toHaveValue(4)
  })
  it('duplicates the terms into a new draft with a new code and link', async () => {
    show(true)
    expect(screen.getByLabelText('Código')).toHaveValue('')
    expect(screen.getByLabelText('Dirección de la oferta')).toHaveValue('')
    expect(screen.getByLabelText('Precio mensual con IVA')).toHaveValue(469.9)
  })
  it('keeps the code and link patterns valid for browsers, which compile them with the v flag', () => {
    show(true)
    for (const [label, good, bad] of [
      ['Código', 'OTONO_2026-B', 'O'],
      ['Dirección de la oferta', 'a-eleccion', 'A eleccion'],
    ] as const) {
      const pattern = screen.getByLabelText(label).getAttribute('pattern')
      const regex = new RegExp(`^(?:${pattern})$`, 'v')
      expect(regex.test(good)).toBe(true)
      expect(regex.test(bad)).toBe(false)
    }
  })
  it('paging the function picker or Enter in its search never saves the draft', async () => {
    const user = userEvent.setup()
    preview.mockResolvedValue({
      definitionHash: 'frozen',
      terms: campaign.draftDefinition.terms,
      selection: { valid: true, featureCodes: [], requiredCount: 2, issues: [] },
      requirements: [],
    })
    show()
    await user.click(screen.getByRole('button', { name: 'Revisar oferta' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled(),
    )
    const [next] = await screen.findAllByRole('button', { name: 'Siguiente' })
    await user.click(next)
    await user.type(
      screen.getAllByLabelText('Buscar en todas las funcionalidades')[0],
      'fac{Enter}',
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(save).not.toHaveBeenCalled()
  })

  // Codex round 2, spec §4.4: the editor warns (never blocks) of another ACTIVE promotion of the same product.
  it('the review warns of another active promotion of the same function in its window, and still saves', async () => {
    const user = userEvent.setup()
    const single: HybridCampaign = {
      ...campaign,
      draftDefinition: {
        schemaVersion: 1,
        kind: 'FEATURES',
        featureCodes: ['CFDI'],
        terms: { ...campaign.draftDefinition.terms },
      },
    }
    preview.mockResolvedValue({
      definitionHash: 'frozen',
      terms: single.draftDefinition.terms,
      selection: { valid: true, featureCodes: ['CFDI'], requiredCount: null, issues: [] },
      requirements: [],
      overlaps: [{ campaignId: 'other', name: 'Otoño · Facturación', price: 129 }],
    })
    save.mockResolvedValue(single)
    show(false, single)
    await user.click(screen.getByRole('button', { name: 'Revisar oferta' }))
    expect(
      await screen.findByText('Ya hay otra promoción activa: Otoño · Facturación $129.00'),
    ).toBeInTheDocument()
    // The window and the campaign under review go with the preview, so it is left out of its own warning.
    expect(preview).toHaveBeenLastCalledWith(single.draftDefinition, [], {
      campaignId: 'campaign',
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
    })
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(save).toHaveBeenCalled())
  })

  it('saves the exact authored pesos and revision after a server preview, without activating sales', async () => {
    const user = userEvent.setup()
    preview.mockResolvedValue({
      definitionHash: 'frozen',
      terms: campaign.draftDefinition.terms,
      selection: {
        valid: false,
        featureCodes: [],
        requiredCount: 2,
        issues: [{ code: 'CHOICE_COUNT', message: 'Elige dos para simular' }],
      },
      requirements: [],
    })
    save.mockResolvedValue(campaign)
    show()
    await user.click(screen.getByRole('button', { name: 'Revisar oferta' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar borrador' }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ definition: campaign.draftDefinition }),
      campaign,
    )
    expect(save.mock.calls[0][0]).not.toHaveProperty('status')
  })
})
