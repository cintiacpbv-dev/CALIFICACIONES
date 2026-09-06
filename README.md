# Letalidad Térmica — F0 / FH

Aplicación web de análisis de penetración de calor. Un **proyecto** es un
equipo en calificación (autoclave, horno); cada equipo tiene sus
**termocuplas** con su certificado de calibración, y sus **corridas**
(cámara vacía, cargada, distintos setpoints…), cada una con su propia hoja
de datos tipo Minitab, sus parámetros de referencia y su cálculo de F0/FH.

Sin autenticación, sin audit trail, sin 21 CFR Parte 11 / ALCOA+: acceso
libre y cálculo matemático puro, por requisito explícito del proyecto.

El motor de cálculo se diseñó analizando planillas de validación reales
(autoclave 115/121°C y horno de despirogenado a 250°C/z=54) — de ahí salen
tres decisiones que no son obvias mirando solo la fórmula de F0:

## Stack

- **Next.js (App Router) + React** — desplegado en **Vercel**.
- **Supabase** (Postgres + Storage) como backend: autoguardado continuo de
  proyectos, termocuplas/calibración, corridas y certificados.
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
   completo. Crea las tablas `projects`, `probes` y `runs`, deja las
   políticas RLS abiertas (sin login, como pide el proyecto) y crea el
   bucket de Storage `calibration-certs`.
3. Copiar `Project URL` y `Publishable key` (Settings → API → Project API
   keys) a `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

La app depende solo de esas dos variables. Si conectás la integración de
Supabase desde el Marketplace de Vercel, ésta agrega de más un montón de
variables `POSTGRES_*` pensadas para un ORM: esta app no las usa, podés
dejarlas ahí sin efecto.

> Si ya tenías el esquema v1 (un proyecto = un dataset plano, sin corridas)
> corriendo, `schema.sql` es idempotente: crea lo nuevo sin tocar lo viejo.
> Para migrar los datos v1 al modelo actual, ejecutar después
> [`supabase/migration_v1_to_v2.sql`](./supabase/migration_v1_to_v2.sql) —
> crea una corrida por proyecto y convierte cada offset en dos puntos de
> calibración equivalentes (verificado: reproduce exacto el cálculo v1).

## Desplegar en Vercel

Conectar el repositorio, cargar las mismas dos variables de entorno en
*Project Settings → Environment Variables*, y desplegar.

> Al ser una SPA sin servidor propio, las credenciales de Supabase quedan
> dentro del JavaScript que descarga el navegador. Mientras las políticas
> RLS estén abiertas (como pide este proyecto), cualquiera con el enlace
> puede leer y escribir los datos — restringirlo requiere autenticación,
> explícitamente fuera de alcance acá.

## Arquitectura de datos

```
projects (equipo)  →  probes (termocuplas + calibración)
                   →  runs (corridas: hoja de datos + parámetros + resultados)
```

- **`probes`**: la calibración vive acá, no en la corrida — el mismo
  certificado (2 o 3 puntos) se reutiliza en todas las corridas del equipo,
  igual que en las planillas de referencia.
- **`runs`**: cada corrida tiene su propio `raw_data` (JSONB
  `{time, series: {probeId: number[]}}`, autoguardado entero con debounce)
  y sus propios `ref_temp_f0/z_value_f0/ref_temp_fh/z_value_fh` — el mismo
  equipo puede correr a 115°C en una corrida y 121°C en otra.
- La **data corregida** y las **curvas de letalidad** nunca se persisten:
  son derivadas de `raw_data + probes.calibration_points + parámetros`, y se
  recalculan en el cliente (`src/lib/lethality.js`, `src/lib/calibration.js`)
  vía `useMemo`. Sólo se cachea `runs.results_summary` para listar sin
  recalcular.

Ver el esquema exacto, comentado, en [`supabase/schema.sql`](./supabase/schema.sql).

## Calibración: regresión de 2-3 puntos, no un offset

Las planillas de referencia no suman un offset constante — arman una recta
por cuadrados mínimos a partir de los puntos del certificado de calibración
(`EQUI` = lo que leyó ese canal en el punto de calibración — mismo dominio
que la data cruda; `TCV` = el valor certificado del patrón en ese punto) y
evalúan esa recta en cada lectura cruda (replica `FORECAST.LINEAR` de
Excel — la fórmula real está en `src/lib/calibration.js`, verificada
numéricamente contra valores de esas planillas). Un offset fijo sólo es
correcto si el error del sensor no cambia con la temperatura; en la
práctica no es así.

## Cálculo de F0 / FH: dos métodos de integración

```
Tasa de letalidad:      L(t) = 10 ^ ((T(t) - Tref) / z)
Valor F (integral):     F = ∫ L(t) dt
```

F0 usa por convención `Tref = 121.1°C, z = 10°C`; FH no tiene un estándar
universal (`Tref = 250°C, z = 54°C` es el default, tomado de una
validación real de despirogenado por calor seco, pero es editable por
corrida).

`src/lib/lethality.js` ofrece **los dos métodos**, calculados siempre en
paralelo:

- **Trapecio** (`computeCumulativeLethalityTrapezoidal`): el recomendado
  por la bibliografía — numéricamente más preciso, tolera intervalos de
  tiempo irregulares.
- **Suma acumulada** (`computeCumulativeLethalitySum`): `F[i] = F[i-1] +
  tasa[i]·Δt`, el método encontrado en las planillas de validación reales.
  Se ofrece para poder conciliar contra corridas históricas ya validadas
  con ese método.

Ambos respetan el mismo **punto de inicio marcado a mano** en la hoja de
datos (`runs.start_index`): en las planillas reales, el conteo de F0/FH no
arranca en t=0 sino en la fila donde empieza la "meseta" de exposición, y
esa fila se elige mirando el gráfico — no sigue una regla fija de
temperatura o tiempo (se comprobó contra 5 corridas reales: el desfase
respecto a "cuando la temperatura llega a Tref−1°C" no es consistente).

## Estructura

```
src/
  app/
    layout.js                       Layout raíz
    page.js                          Panel central: lista de proyectos
    proyecto/[id]/page.js           Overview de un proyecto (equipo)
    proyecto/[id]/corrida/[runId]/  Workspace de una corrida
    globals.css
  components/
    ProjectPanel.jsx                 Lista/crea/elimina proyectos
    ProjectWorkspace.jsx             Overview: datos del equipo, calibración, corridas
    CalibrationPanel.jsx             Puntos de calibración por termocupla
    RunWorkspace.jsx                 Orquesta una corrida: estado, cálculo, autoguardado
    DataSheet.jsx                    Hoja de datos + marca de inicio de conteo
    SettingsPanel.jsx                Parámetros F0/FH y unidad de tiempo (por corrida)
    ResultsSummary.jsx               F0/FH por sensor, ambos métodos
    TemperatureChart.jsx             Temperatura corregida vs. tiempo
    LethalityChart.jsx               Letalidad acumulada (F0/FH × trapecio/suma)
    ChartTooltip.jsx                 Tooltip compartido de los gráficos
    AutosaveBadge.jsx                Indicador de autoguardado
  lib/
    lethality.js                     Motor F0/FH: los dos métodos de integración
    calibration.js                   Regresión de calibración (2-3 puntos)
    dataImport.js                    Parseo de CSV / Excel / texto pegado
    projectsApi.js                   CRUD de proyectos/probes/runs contra Supabase
    supabaseClient.js                Cliente Supabase (o null sin credenciales)
    useDebouncedAutosave.js          Hook de autoguardado con debounce
supabase/
  schema.sql                        Esquema completo, comentado, idempotente
  migration_v1_to_v2.sql            Migración opcional de datos del esquema v1
```

## Próximos pasos posibles

- Exportar la tabla de resultados / gráficos a Excel o PDF.
- Edición de rango completo (pegado multi-celda) directamente sobre la
  tabla, hoy resuelto vía el modal "Pegar datos".
- Historial de calibraciones por sensor (hoy es 1 certificado activo por
  termocupla).
