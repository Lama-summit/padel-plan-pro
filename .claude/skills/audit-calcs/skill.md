# audit-calcs

Audita cálculos financieros comparando la implementación en código con una fuente de verdad externa (Excel del socio).

## Contexto del proyecto

- Cálculos principales: `src/lib/calculations.ts`
- Tipos e inputs: `src/lib/types.ts` (interfaz `ProjectInputs`)
- Constantes clave: `DAYS_PER_MONTH=30`, `MONTHS_PER_YEAR=12`, `PEAK_RATIO=0.4`, `OFFPEAK_RATIO=0.6`

## Flujo de auditoría

### Fase 1: Mapeo (Excel → Código)

Para cada variable/KPI del Excel, documentar:

| Excel (celda/nombre) | Código (función/línea) | Fórmula Excel | Fórmula Código | Estado |
|---|---|---|---|---|
| ... | ... | ... | ... | ✅ OK / ⚠️ Discrepancia / ❌ No implementado |

Generar este mapeo en un archivo temporal `docs/audit-map.md` (o donde el usuario indique).

### Fase 2: Verificación de fórmulas existentes

Para cada KPI que ya existe en código, verificar:

1. **Inputs**: ¿Usa las mismas variables de entrada que el Excel?
2. **Fórmula**: ¿La operación matemática es idéntica?
3. **Unidades**: ¿Mensual vs anual? ¿Porcentaje (0-1) vs (0-100)?
4. **Edge cases**: ¿Qué pasa con division by zero, inputs en 0, etc.?

Reportar discrepancias con:
- Línea exacta en `calculations.ts`
- Fórmula esperada (Excel)
- Fórmula actual (código)
- Impacto estimado (alto/medio/bajo)

### Fase 3: Implementación de nuevos cálculos

Para variables del Excel que NO existen en código:

1. Añadir la función/cálculo en `calculations.ts`.
2. Si necesita inputs nuevos → añadirlos en `ProjectInputs` (types.ts) con defaults razonables.
3. Exponer en `KPIResult` o en una nueva interfaz si es un bloque separado.
4. **NO es obligatorio** mostrarlos en la UI — basta con que sean calculables y accesibles.
5. Documentar brevemente qué se añadió y por qué no se expone en UI (si aplica).

## Métricas ya implementadas (referencia rápida)

### Revenue
- `courtRevenueMonth`: (peakBookingHours × peakOcc × peakPrice) + (offPeakBookingHours × offPeakOcc × offPeakPrice)
- `coachingRevenueMonth`: coachingHoursMonth × coachingPricePerHour
- `tournamentsRevenueMonth`: tournamentsPerMonth × tournamentRevenuePerEvent
- `eventsRevenueMonth`: eventsPerMonth × eventRevenuePerEvent
- `otherRevenueMonth`: sum(otherRevenueItems.monthlyRevenue)
- `totalRevenueMonth`: suma de todas las líneas
- `totalRevenueYear`: totalRevenueMonth × 12

### Costs
- `courtDirectCostMonth`: variableCostPerHour × bookedHoursMonth
- `indirectCostsMonth`: calculateCostBreakdown() × costMultiplier (scenario)
- `costBreakdown.details`: staff, rent, software, energy, maintenance, cleaning, marketing, insurance

### Profitability
- `ebitdaMonth`: totalRevenueMonth − totalAllCostsMonth
- `ebitdaMargin`: (ebitdaMonth / totalRevenueMonth) × 100
- `roi`: (ebitdaYear / investment) × 100
- `paybackYears`: investment / ebitdaYear
- `breakEvenOccupancy`: binary search donde EBITDA anual ≥ inversión

### Financing
- `loanAmount`: investment × (debtPercentage / 100)
- `loanPaymentMonth`: amortización francesa (PMT)
- `equityInvested`: investment − loanAmount
- `cashFlowToEquity`: ebitdaYear − annualDebtPayment
- `roiOnEquity`: (cashFlowToEquity / equityInvested) × 100
- `paybackEquity`: equityInvested / cashFlowToEquity

### Revenue Breakdown (por línea)
- Cada línea tiene: revenue, directCost, allocatedIndirect (proporcional a % revenue), EBITDA, margin

### Projections
- `calculate5YearProjection`: crecimiento compuesto con growthRate (default 5%)
- `getMonthlyEvolution`: estacionalidad fija [0.7..1.15..0.8]
- `calculatePaybackCumulative`: payback interpolado sobre 5Y projection

## Cómo invocar esta skill

### Input principal: archivo Excel

El usuario proporcionará la **ruta al archivo Excel** en su disco (`.xlsx`, `.xls`, o `.csv`).

**Lectura del Excel:**
```bash
# Leer estructura (nombres de hojas)
python3 -c "import openpyxl; wb=openpyxl.load_workbook('RUTA'); print(wb.sheetnames)"

# Leer hoja completa a texto tabular
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('RUTA', data_only=True)
ws = wb['NOMBRE_HOJA']
for row in ws.iter_rows(values_only=True):
    print('\t'.join([str(c) if c is not None else '' for c in row]))
"

# Alternativa con pandas (más potente para análisis)
python3 -c "
import pandas as pd
df = pd.read_excel('RUTA', sheet_name='NOMBRE_HOJA')
print(df.to_string())
"

# Para leer fórmulas (no valores calculados):
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('RUTA')  # sin data_only
ws = wb['NOMBRE_HOJA']
for row in ws.iter_rows():
    for cell in row:
        if cell.value and str(cell.value).startswith('='):
            print(f'{cell.coordinate}: {cell.value}')
"
```

**Si falta openpyxl o pandas:** instalar con `pip3 install openpyxl pandas`.

### Flujo de trabajo

1. El usuario da la ruta del Excel.
2. Leer nombres de hojas → mostrar al usuario cuáles hay.
3. Leer la hoja relevante (valores + fórmulas).
4. El usuario indica en qué fase trabajar (mapeo, verificación, o implementación).

### Qué hacer en cada fase

1. Comparar con precisión la fórmula del Excel vs el código.
2. Usar valores numéricos de ejemplo para verificar que dan el mismo resultado.
3. Proponer cambios concretos (ediciones a `calculations.ts`) cuando haya discrepancias.
4. Para cálculos nuevos: implementarlos directamente, exponerlos en la interfaz `KPIResult` si son KPIs principales, o en interfaces auxiliares si son intermedios.

## Reglas

- **Nunca cambiar un cálculo sin confirmar** que la fórmula del Excel es la correcta y que entendemos la diferencia.
- **Documentar cada cambio** con un comentario inline SOLO si la fórmula no es obvia (e.g., un ajuste fiscal específico).
- **Mantener safe math**: usar `safe()`, `safeDiv()`, y `makeSafeMetric()` para todo cálculo nuevo.
- **Tests manuales**: tras cada cambio, proponer un set de inputs y el resultado esperado para que el usuario verifique contra el Excel.
- **No romper UI**: si se cambia una fórmula existente, verificar qué componentes la consumen y que no se rompe nada.
