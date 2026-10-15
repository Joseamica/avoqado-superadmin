import { PercentInput } from './PercentInput'

export function IntermediaryFeeField({
  id = 'intermediary-fee',
  value,
  onChange,
}: {
  id?: string
  value: number
  onChange: (rate: number) => void
}) {
  return (
    <div className="my-4">
      <label htmlFor={id} className="label mb-1 block text-[var(--ink-muted)]">
        Manejo del intermediario (%)
      </label>
      <PercentInput id={id} value={value} onChange={onChange} className="w-full sm:w-28" />
      <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
        Cargo final sobre lo que recibe el banco después del procesador. No se agrega IVA. Se
        descuenta antes de repartir el margen agregador. 0 = sin cargo.
      </p>
    </div>
  )
}
