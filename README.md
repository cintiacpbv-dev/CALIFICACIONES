# Letalidad Térmica — F0 / FH

Aplicación web de análisis de penetración de calor: hoja de datos
interactiva (tipo Minitab) para cargar temperatura de varios sensores en el
tiempo, corregir la data cruda con los offsets de calibración de cada
termocupla, y calcular/graficar F0 y FH automáticamente.

Sin autenticación, sin audit trail, sin 21 CFR Parte 11 / ALCOA+: acceso
libre y cálculo matemático puro, por requisito explícito del proyecto.

## Stack

- **Next.js (App Router) + React** — desplegado en **Vercel**.
- **Supabase** (Postgres + Storage) como backend: autoguardado continuo de
  proyectos, sensores/offsets y certificados de calibración.
- **Recharts** para los gráficos, tabla editable propia para la hoja de
  cálculo, **papaparse**/**xlsx** para importar CSV/Excel.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar con tus credenciales de Supabase
npm run dev
```

Abre http://localhost:3000

## Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutar [`supabase/schema.sql`](./supabase/schema.sql)
   completo. Crea las tablas `projects` y `sensors`, dejа las políticas RLS
   abiertas (sin login, como pide el proyecto) y crea el bucket de Storage
   `calibration-certs` para los PDFs de calibración.
3. Copiar `Project URL` y `Publishable key` (Settings → API → Project API
   keys) a `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

La app depende solo de esas dos variables — la misma URL + clave pública que
usa el resto de los proyectos de la organización con Supabase. Si conectás
la integración de Supabase desde el Marketplace de Vercel, ésta agrega de
más un montón de variables `POSTGRES_*` (URL directa, pooling, credenciales)
pensadas para usar un ORM como Prisma: esta app no las usa ni las necesita,
podés dejarlas ahí sin efecto.

Sin las dos variables que sí usa, la app igual carga, pero el panel de
proyectos avisa que no hay guardado en la nube (no hay fallback a
`localStorage`: el requisito es
persistencia en Supabase).

## Desplegar en Vercel

Conectar el repositorio, cargar las mismas dos variables de entorno en
*Project Settings → Environment Variables*, y desplegar. Cada push a la rama
de producción se publica solo.

> Al ser una SPA sin servidor propio, las credenciales de Supabase quedan
> dentro del JavaScript que descarga el navegador. Mientras las políticas
> RLS estén abiertas (como pide este proyecto), cualquiera con el enlace
> puede leer y escribir los datos. Para restringirlo hace falta agregar
> autenticación y cerrar las políticas — explícitamente fuera de alcance
> aquí.

## Arquitectura de datos

Un **proyecto** guarda la grilla completa como un único JSONB
(`projects.raw_data = {time: number[], series: {sensorId: number[]}}`) que
se autoguarda entero con debounce, en vez de una fila por celda — encaja con
el patrón "pegar una hoja completa" y evita cientos de escrituras por
segundo mientras se edita.

Los **sensores** (`sensors`) llevan su offset de corrección y sus datos de
calibración (número de certificado, fecha, notas, PDF en Storage) 1:1 con el
sensor.

La **data corregida** y las **curvas de letalidad** nunca se persisten: son
puramente derivadas de `raw_data + sensors.offset_celsius + parámetros de
referencia`, y se recalculan en el cliente (`src/lib/lethality.js`) en cada
render vía `useMemo`. Guardar un duplicado corregido en la base violaría la
única fuente de verdad. Sólo se cachea `projects.results_summary` (F0/FH
final por sensor) para poder listar el panel de proyectos sin recalcular
todo.

Ver el esquema exacto, comentado, en [`supabase/schema.sql`](./supabase/schema.sql).

## Cálculo de F0 / FH

```
Tasa de letalidad:      L(t) = 10 ^ ((T(t) - Tref) / z)
Valor F (integral):     F = ∫ L(t) dt      (trapecios, en minutos)
```

F0 usa por convención `Tref = 121.1 °C`, `z = 10 °C` (esterilización por
vapor). FH es la misma fórmula con una `Tref`/`z` configurables por proyecto
(otro producto o proceso puede requerir otra referencia) — no son dos
matemáticas distintas, comparten `computeCumulativeLethality` en
`src/lib/lethality.js`.

La integración es por trapecios sobre pasos de tiempo no necesariamente
uniformes (soporta datos importados con intervalos irregulares), y devuelve
tanto el valor final como la serie acumulada punto a punto para el gráfico
de letalidad.

## Estructura

```
src/
  app/
    layout.js                Layout raíz
    page.js                   Panel central: lista de proyectos guardados
    proyecto/[id]/page.js    Workspace de un proyecto
    globals.css
  components/
    ProjectPanel.jsx          Lista/crea/elimina proyectos
    ProjectWorkspace.jsx      Orquesta un proyecto: estado, cálculo y autoguardado
    DataSheet.jsx             Hoja de datos (grid + pegado + carga CSV/Excel)
    OffsetsPanel.jsx          Offsets y certificados de calibración por sensor
    SettingsPanel.jsx         Parámetros de referencia F0/FH y unidad de tiempo
    ResultsSummary.jsx        Tabla final F0/FH por sensor
    TemperatureChart.jsx      Gráfico 1: temperatura corregida vs. tiempo
    LethalityChart.jsx        Gráfico 2: letalidad acumulada vs. tiempo
    AutosaveBadge.jsx         Indicador de estado de autoguardado
  lib/
    lethality.js              Motor de cálculo F0/FH + aplicación de offsets
    dataImport.js              Parseo de CSV / Excel / texto pegado
    projectsApi.js              CRUD de proyectos y sensores contra Supabase
    supabaseClient.js           Cliente Supabase (o null sin credenciales)
    useDebouncedAutosave.js     Hook de autoguardado con debounce
supabase/
  schema.sql                  Esquema completo, comentado, listo para pegar
```

## Próximos pasos posibles

- Exportar la tabla de resultados / gráficos a Excel o PDF.
- Edición de rango completo (pegado multi-celda) directamente sobre la
  tabla, hoy resuelto vía el modal "Pegar datos" por ser más confiable entre
  navegadores que el evento de portapapeles celda por celda.
- Historial de calibraciones por sensor (hoy es 1 registro activo por sensor).
