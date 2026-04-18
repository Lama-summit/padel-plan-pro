---
name: unify-styles
description: Audita y unifica colores, tipografía y estilos de KPIs entre todos los componentes del proyecto
---

# unify-styles

Audita y unifica estilos visuales entre componentes del proyecto.

## Sistema de colores semántico

- **Blue** (`text-blue-600`): datos neutros, métricas informativas
- **Green** (`text-green-600`): valores positivos, beneficios, crecimiento
- **Red** (`text-red-600`): valores negativos, costes, pérdidas
- **Orange** (`text-orange-500`): umbrales, break-even, warnings

## Tipografía KPIs

- Valor principal: `text-2xl font-extrabold`
- Label: `text-sm text-muted-foreground`
- Subtítulo de sección: `text-lg font-semibold`

## Proceso

1. Leer todos los componentes en `src/components/` que renderizan métricas o KPIs.
2. Identificar inconsistencias de color o tamaño respecto al sistema definido arriba.
3. Aplicar los cambios asegurando que:
   - Métricas del mismo tipo usan el mismo color en todas las tabs.
   - No se usa `text-gray-900` para valores que tienen semántica (positivo/negativo/umbral).
   - `KPICard.tsx` es la referencia canónica de estilo.
4. Verificar con `npm run build` que no hay errores.

## Componentes a auditar

- `src/components/KPICard.tsx`
- `src/components/Dashboard.tsx` (o `DashboardCharts.tsx`)
- `src/components/RevenueModelTab.tsx`
- `src/components/ROIAnalysisTab.tsx`
- `src/components/KeyDriversPanel.tsx`
- `src/components/SensitivityMatrix.tsx`
