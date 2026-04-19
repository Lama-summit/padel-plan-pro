---
name: notion-task
description: Gestiona tareas del board de Notion de Summit Padel — lee, ejecuta, y actualiza el estado de tareas del proyecto
---

# notion-task

Gestiona el ciclo de vida de tareas desde el board de Notion del proyecto Summit Padel.

## Conexion Notion

- **Data source ID** (base de datos "To do"): `4c586bd1-3230-46f3-ba97-e9e046b0a0ed`
- **Usuario Daniel** (Owner): Notion user ID `33fd872b-594c-8163-8137-00025f0f4c9d`

## Propiedades de la base de datos

| Propiedad | Tipo | Valores |
|-----------|------|---------|
| Descripcion | title | Texto libre |
| Estado | status | Sin empezar, En progreso, Listo, Bloqueado, Revisado |
| Prioridad | select | Alta (red), Media (yellow), Baja (green) |
| Dificultad | select | Simple (green), Moderada (yellow), Compleja (red) |
| Tipo | select | Idea, Diseno, Datos, Funcionalidad, Informacion |
| Stage | select | Definicion, Implementacion |
| Apartado | select | All inputs, Executive Summary, ROI Analysis, Todo, Revenues, Inicio, Investment |
| Owner | people | Daniel Arranz Lopez, Pablo Alonso |
| Fecha | date | Fecha de creacion |
| Comentarios | rich_text | Notas adicionales |
| Entegable | files | Archivos adjuntos |
| ID | unique_id | Auto-incremental |

## Flujo de trabajo

### Comando: Listar tareas

Cuando el usuario pida ver tareas o seleccionar una para trabajar:

1. Consultar la base de datos con `mcp__notion__API-query-data-source` (data_source_id: `4c586bd1-3230-46f3-ba97-e9e046b0a0ed`)
2. Parsear resultados y mostrar tabla resumen con: #ID, Estado, Prioridad, Dificultad, Apartado, Descripcion
3. Agrupar por estado o prioridad segun contexto

### Comando: Empezar tarea #N

Cuando el usuario elija una tarea para trabajar:

1. **Cambiar estado a "En progreso"** automaticamente (sin preguntar):
   ```
   mcp__notion__API-patch-page → properties: {"Estado": {"status": {"name": "En progreso"}}}
   ```
2. Leer la descripcion completa y comentarios de la tarea
3. Explorar el codigo relevante segun el Apartado y Tipo
4. Planificar e implementar los cambios necesarios

### Comando: Completar tarea

Cuando la implementacion este terminada:

1. **SIEMPRE preguntar al usuario**: "Esta tarea esta realizada?"
2. **Solo tras confirmacion explicita** del usuario, cambiar estado a "Listo":
   ```
   mcp__notion__API-patch-page → properties: {"Estado": {"status": {"name": "Listo"}}}
   ```
3. **NUNCA marcar como Listo sin confirmacion**

### Comando: Crear tarea

Si el usuario quiere anadir una nueva tarea:

1. Pedir: descripcion, prioridad, tipo, apartado
2. Asignar dificultad (Simple/Moderada/Compleja) basandose en el analisis del codigo
3. Crear con `mcp__notion__API-post-page` con parent database_id
4. Owner por defecto: Daniel

## Reglas criticas

- **Solo dos estados permitidos para modificar**: "En progreso" y "Listo"
- **"En progreso"**: se pone automaticamente al empezar una tarea
- **"Listo"**: SIEMPRE requiere confirmacion explicita del usuario
- Al listar tareas, excluir las que ya estan en "Listo" salvo que se pida lo contrario
- Si una tarea tiene comentarios o entregables, leerlos antes de empezar

## Mapeo Apartado → Codigo

| Apartado | Archivos principales |
|----------|---------------------|
| All inputs | `src/pages/InputsView.tsx`, `src/components/KeyDriversPanel.tsx` |
| Executive Summary | `src/pages/Dashboard.tsx` (tab summary) |
| ROI Analysis | `src/components/ROIAnalysisTab.tsx` |
| Revenues | `src/components/RevenueModelTab.tsx` |
| Investment | `src/components/InvestmentTab.tsx` |
| Inicio | `src/pages/Dashboard.tsx` (header), `src/pages/ProjectsHome.tsx` |
| Todo | Aplica a multiples archivos, explorar segun descripcion |

## Herramientas Notion necesarias

Antes de usar cualquier herramienta de Notion, cargarla con ToolSearch:
```
ToolSearch("select:mcp__notion__API-query-data-source,mcp__notion__API-patch-page,mcp__notion__API-retrieve-a-page,mcp__notion__API-post-search")
```
