import type { ComboboxOption } from '@/shared/ui/Combobox'
import type { VenueType } from './api'

/**
 * Catálogo de venue types agrupado en 7 categorías operativas. El backend
 * acepta 35+ valores enum; aquí los presentamos por categorías. La
 * categoría va como `description` en el Combobox para que aparezca abajo
 * del label sin perder el agrupamiento visual.
 */
const VENUE_TYPE_GROUPS: Array<{
  label: string
  types: Array<{ value: VenueType; label: string }>
}> = [
  {
    label: 'Restaurantes y bares',
    types: [
      { value: 'RESTAURANT', label: 'Restaurante' },
      { value: 'BAR', label: 'Bar' },
      { value: 'CAFE', label: 'Café' },
      { value: 'BAKERY', label: 'Panadería' },
      { value: 'FAST_FOOD', label: 'Comida rápida' },
      { value: 'FOOD_TRUCK', label: 'Food truck' },
      { value: 'CATERING', label: 'Catering' },
      { value: 'CLOUD_KITCHEN', label: 'Cocina fantasma' },
    ],
  },
  {
    label: 'Tiendas',
    types: [
      { value: 'RETAIL_STORE', label: 'Tienda general' },
      { value: 'CLOTHING', label: 'Ropa' },
      { value: 'JEWELRY', label: 'Joyería' },
      { value: 'ELECTRONICS', label: 'Electrónica' },
      { value: 'PHARMACY', label: 'Farmacia' },
      { value: 'CONVENIENCE_STORE', label: 'Tienda de conveniencia' },
      { value: 'SUPERMARKET', label: 'Supermercado' },
      { value: 'LIQUOR_STORE', label: 'Vinatería' },
      { value: 'FURNITURE', label: 'Muebles' },
      { value: 'HARDWARE', label: 'Ferretería' },
      { value: 'BOOKSTORE', label: 'Librería' },
      { value: 'PET_STORE', label: 'Mascotas' },
      { value: 'TELECOMUNICACIONES', label: 'Telecomunicaciones' },
    ],
  },
  {
    label: 'Servicios',
    types: [
      { value: 'CLINIC', label: 'Clínica médica' },
      { value: 'VETERINARY', label: 'Veterinaria' },
      { value: 'FITNESS', label: 'Gimnasio / fitness' },
      { value: 'AUTO_SERVICE', label: 'Servicio automotriz' },
      { value: 'LAUNDRY', label: 'Lavandería' },
      { value: 'REPAIR_SHOP', label: 'Reparaciones' },
    ],
  },
  {
    label: 'Estéticas y spas',
    types: [
      { value: 'SALON', label: 'Estética / salón' },
      { value: 'SPA', label: 'Spa' },
    ],
  },
  {
    label: 'Hospedaje',
    types: [
      { value: 'HOTEL', label: 'Hotel' },
      { value: 'HOSTEL', label: 'Hostal' },
      { value: 'RESORT', label: 'Resort' },
    ],
  },
  {
    label: 'Entretenimiento',
    types: [
      { value: 'CINEMA', label: 'Cine' },
      { value: 'NIGHTCLUB', label: 'Antro / nightclub' },
      { value: 'EVENT_VENUE', label: 'Salón de eventos' },
      { value: 'ARCADE', label: 'Arcade' },
      { value: 'BOWLING', label: 'Bowling' },
    ],
  },
  {
    label: 'Otro',
    types: [{ value: 'OTHER', label: 'Otro / no listado' }],
  },
]

/**
 * Versión plana de `VENUE_TYPE_GROUPS` para el `Combobox` — cada opción
 * lleva su categoría en `description` para preservar el contexto visual.
 * `searchTokens` agrega la categoría como término de búsqueda para que
 * "tienda" matchee todos los retail options.
 */
export const VENUE_TYPE_OPTIONS: ComboboxOption[] = VENUE_TYPE_GROUPS.flatMap((group) =>
  group.types.map((t) => ({
    value: t.value,
    label: t.label,
    description: group.label,
    searchTokens: group.label,
  })),
)

/** Single-select del binario Persona Física / Moral. Sólo 2 opciones — el Combobox sigue siendo consistente con el resto del form. */
export const ENTITY_TYPE_OPTIONS: ComboboxOption[] = [
  { value: 'PERSONA_FISICA', label: 'Persona Física' },
  { value: 'PERSONA_MORAL', label: 'Persona Moral' },
]
