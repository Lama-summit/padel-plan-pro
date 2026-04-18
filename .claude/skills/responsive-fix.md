# responsive-fix

Audita y corrige problemas de responsive en un componente.

## Patrones del proyecto

### Tablas con overflow
```tsx
<div className="overflow-x-auto scrollbar-hide">
  <table className="min-w-[600px] w-full">
    ...
  </table>
</div>
```

### Clase scrollbar-hide
Ya definida en `globals.css`:
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

### Grid responsive
```tsx
// 1 col mobile, 2 cols tablet, 3 cols desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Charts responsive
- Siempre usar `<ResponsiveContainer>`.
- Height mínima razonable (200-300px).
- En mobile, considerar apilar charts verticalmente.

## Proceso

1. Identificar el componente objetivo.
2. Buscar:
   - Tablas sin wrapper `overflow-x-auto`.
   - Grids con columnas fijas que no colapsan en mobile.
   - Elementos con `width` fijo o `min-width` que rompen en pantallas < 768px.
   - Charts sin `ResponsiveContainer`.
   - Textos que se truncan o desbordan.
3. Aplicar los patrones del proyecto.
4. Verificar con `npm run build`.

## Breakpoints (Tailwind defaults)

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
