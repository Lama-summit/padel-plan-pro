---
name: enhance-chart
description: Mejora un componente de Recharts con tooltips, reference lines, labels inteligentes y responsive
---

# enhance-chart

Mejora un componente de Recharts con elementos visuales adicionales.

## Stack

- Librería: `recharts`
- Componentes comunes: `BarChart`, `LineChart`, `PieChart`, `ComposedChart`
- Estilos: Tailwind CSS + shadcn/ui

## Mejoras disponibles

### Reference Lines
- Usar `<ReferenceLine>` para mostrar umbrales (costes totales, break-even, target).
- Siempre incluir `label` con el valor formateado y `strokeDasharray="3 3"` para líneas de referencia.

### Tooltips
- Custom tooltip con `<Tooltip content={<CustomTooltip />} />`.
- Formatear valores con `currency.ts` helpers.
- Incluir contexto (% de variación, comparación con escenario base).

### Pie Chart Labels
- Para segmentos > 10%: label exterior con nombre + porcentaje.
- Para segmentos < 10%: solo porcentaje o agrupar en "Otros".
- Usar `labelLine={false}` en segmentos pequeños.

### Responsive
- Envolver siempre en `<ResponsiveContainer width="100%" height={X}>`.
- Ajustar `fontSize` de labels según breakpoint si es necesario.

## Proceso

1. Identificar el chart objetivo (el usuario indicará cuál).
2. Leer el componente actual.
3. Aplicar las mejoras solicitadas manteniendo coherencia con otros charts del proyecto.
4. Usar colores del sistema semántico (ver `unify-styles` skill).
5. Verificar con `npm run build`.
