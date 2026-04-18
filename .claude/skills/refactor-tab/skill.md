# refactor-tab

Refactoriza un tab para centralizar estado en `ProjectInputs` y eliminar estado local innecesario.

## Arquitectura del proyecto

- Estado global: `src/lib/store.tsx` (context con `ProjectInputs`)
- Tipos: `src/lib/types.ts` (interfaz `ProjectInputs` y tipos auxiliares)
- Cálculos: `src/lib/calculations.ts` (derivados de `ProjectInputs`)
- Tabs: `src/components/*Tab.tsx`

## Patrón correcto

```tsx
// El tab recibe inputs y handler del store
interface TabProps {
  inputs: ProjectInputs;
  onInputChange: (key: string, value: any) => void;
}

// NO usar useState local para datos que pertenecen a ProjectInputs
// SÍ usar useState para UI state (modals abiertos, tab activa, etc.)
```

## Proceso

1. Leer el tab objetivo.
2. Identificar `useState` locales que duplican o derivan de `ProjectInputs`.
3. Si el campo no existe en `ProjectInputs`/`types.ts`, añadirlo con tipo apropiado.
4. Migrar la lógica de cambio al `onInputChange` handler.
5. Eliminar estado local redundante.
6. Verificar que handlers de add/update/remove (arrays como investors, phases) funcionan correctamente con el nuevo patrón.
7. Run `npm run build` para verificar tipado.

## Checklist

- [ ] No hay `useState` para datos de negocio (solo UI state).
- [ ] Nuevos campos añadidos a `ProjectInputs` con valores default en el store.
- [ ] Tipos auxiliares (e.g. `InvestorEntry`, `TimelinePhase`) exportados desde `types.ts`.
- [ ] `onInputChange` maneja arrays correctamente (spread, filter, map).
