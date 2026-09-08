# Letalidad Térmica — F0 / FH

Aplicación web de análisis de penetración de calor. Un **proyecto** es un
equipo en calificación (autoclave, horno); cada equipo tiene sus
**termocuplas** con su certificado de calibración, y sus **corridas**
(cámara vacía, cargada, distintos setpoints…), cada una con su propia hoja
de datos tipo Minitab, sus parámetros de referencia, sus criterios de
aceptación y su cálculo de F0/FH.

Cada corrida se cierra con un **informe exportable**: un `.xlsx` con todo lo
necesario para reproducir el número sin abrir la app, y una versión
imprimible («Guardar como PDF») lista para anexar al protocolo.

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

> Si ya tenías el esquema v2 corriendo, `schema.sql` es idempotente y podés
> volver a ejecutarlo entero. Si preferís el bloque mínimo, ejecutá sólo
> [`supabase/migration_v2_to_v3.sql`](./supabase/migration_v2_to_v3.sql):
> agrega los criterios de aceptación, la condición de trabajo y el cache del
> veredicto. Son todas columnas nullables, no toca ningún dato existente.

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

Ambos cuentan sólo dentro de la **ventana marcada a mano** en la hoja de
datos (`runs.start_index` / `runs.end_index`): en las planillas reales el
conteo de F0/FH no cubre todo el registro — arranca donde empieza la
"meseta" de exposición y **corta antes del enfriamiento**. Ninguno de los
dos límites sigue una regla fija de temperatura o tiempo: se eligen mirando
el gráfico (se comprobó contra 5 corridas reales que el desfase respecto a
"cuando la temperatura llega a Tref−1°C" no es consistente).

Que la ventana tenga fin no es un detalle: en una corrida real, integrar
hasta el final del registro en vez de cortar al terminar la meseta
**sobreestima el F0 un 4,6%**.

## Criterios de aceptación

Cada corrida puede declarar un F0/FH mínimo y una banda de temperatura
(LI/LS, como la de 240-260 °C que traía la planilla del horno de
despirogenado). Con eso la app deja de contestar sólo «cuánto dio» y pasa a
contestar «pasa o no pasa»:

- El **F0/FH mínimo se exige al sensor más frío**: en un estudio de
  penetración de calor el peor sensor gobierna la aceptación.
- La **banda de temperatura se evalúa sólo dentro de la ventana de conteo**
  — fuera de la meseta la temperatura obviamente está por debajo del LI, así
  que evaluar el registro completo daría siempre «no cumple». Se dibuja
  sobre el gráfico de temperatura, que tiene un zoom a la ventana para poder
  verla (con el registro entero, una banda de 3 °C sobre un eje de 0-140 °C
  es ilegible).
- Un criterio **vacío es «no definido»**: no se evalúa y no cuenta como
  incumplimiento.
- El veredicto usa el **trapecio**. La columna «suma» queda para conciliar
  históricos, no para decidir.

El veredicto de cada corrida se cachea en `runs.acceptance_summary` para que
el **resumen del estudio** (en la página del equipo) pueda comparar todas
las corridas — peor F0, punto frío recurrente, cuáles no cumplen — sin traer
la data cruda de cada una.

## Chequeos de integridad de datos

El motor de letalidad es tolerante a propósito: si un Δt no es positivo o
una celda está vacía, saltea ese intervalo en vez de romper. Eso evita que
la app explote con datos sucios, pero también haría que un dato mal pegado
baje el F0 **sin avisar**. `src/lib/dataQuality.js` hace explícita cada una
de esas condiciones:

| Aviso | Por qué importa |
| --- | --- |
| Ventana invertida | El fin quedó antes que el inicio: F0/FH da 0. |
| Filas sin tiempo | Sin Δt, esos intervalos quedan fuera de la integral. |
| Tiempo desordenado | Δt negativo: el intervalo no suma y el F0 queda bajo. |
| Tiempos repetidos | Δt = 0: la fila no aporta letalidad. |
| Huecos dentro de la ventana | El sensor se integró sobre menos tiempo del que muestra la ventana. |
| Sensor sin calibración | Se está usando la lectura cruda, sin corregir. |

## Informe exportable

- **Excel** (`Exportar Excel`): un libro con `Informe` (condición de
  trabajo, parámetros, criterios y veredicto), `Resultados`, `Calibración`,
  `Data cruda`, `Data corregida` y `Letalidad acumulada` (F0 y FH × trapecio
  y suma, fila por fila). La idea es que el archivo alcance para reproducir
  el número sin abrir la app. SheetJS se carga bajo demanda, así que no pesa
  en la carga inicial de la corrida.
- **PDF** (`Informe PDF`): abre el diálogo de impresión con una hoja de
  informe — encabezado con la condición de trabajo, parámetros, calibración
  aplicada, veredicto, tabla de resultados y los dos gráficos. Se usa el
  motor de impresión del navegador y no una captura a canvas a propósito:
  los gráficos son SVG y así salen vectoriales a la resolución del papel.

### Verificación contra una corrida real

El motor se validó reproduciendo una corrida completa del autoclave
(canal C03, 61 lecturas): con la calibración de 3 puntos, la ventana
marcada y el método de suma, los 26 valores del acumulado coinciden con la
planilla **a 0.000e+0 de diferencia**. La única salvedad es que la planilla
asume Δt = 1 minuto exacto mientras la app usa el Δt real de los
timestamps, que traen ±5 ms de jitter — eso mueve el resultado 3,4e-6 en
términos relativos.

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
    StudySummary.jsx                 Comparativa de todas las corridas del equipo
    CalibrationPanel.jsx             Puntos de calibración por termocupla
    RunWorkspace.jsx                 Orquesta una corrida: estado, cálculo, autoguardado
    DataSheet.jsx                    Hoja de datos, navegación por teclado, ventana de conteo
    RunMetaPanel.jsx                 Condición de trabajo (fecha, lote, ciclo, carga…)
    SettingsPanel.jsx                Parámetros F0/FH y unidad de tiempo (por corrida)
    AcceptancePanel.jsx              Criterios de aceptación de la corrida
    DataQualityPanel.jsx             Avisos de integridad de datos
    ResultsSummary.jsx               Veredicto + F0/FH por sensor, ambos métodos
    TemperatureChart.jsx             Temperatura corregida, banda LI/LS, zoom a la ventana
    LethalityChart.jsx               Letalidad acumulada (F0/FH × trapecio/suma)
    RunReport.jsx                    Encabezado y pie del informe imprimible
    ChartTooltip.jsx                 Tooltip compartido de los gráficos
    Toast.jsx                        Notificaciones no bloqueantes (+ deshacer)
    ConfirmDialog.jsx                Confirmación de acciones destructivas
    Skeleton.jsx                     Placeholders de carga
    AutosaveBadge.jsx                Indicador de autoguardado
  lib/
    lethality.js                     Motor F0/FH: los dos métodos de integración
    calibration.js                   Regresión de calibración (2-3 puntos)
    acceptance.js                    Evaluación de criterios de aceptación
    dataQuality.js                   Chequeos de integridad de los datos
    reportData.js                    Modelo del informe (compartido Excel / impresión)
    exportExcel.js                   Armado y descarga del .xlsx
    dataImport.js                    Parseo de CSV / Excel / texto pegado
    projectsApi.js                   CRUD de proyectos/probes/runs contra Supabase
    supabaseClient.js                Cliente Supabase (o null sin credenciales)
    useDebouncedAutosave.js          Hook de autoguardado con debounce
supabase/
  schema.sql                        Esquema completo, comentado, idempotente
  migration_v1_to_v2.sql            Migración opcional de datos del esquema v1
  migration_v2_to_v3.sql            Criterios de aceptación + condición de trabajo
```

## Próximos pasos posibles

- Edición de rango completo (pegado multi-celda) directamente sobre la
  tabla, hoy resuelto vía el modal "Pegar datos".
- Historial de calibraciones por sensor (hoy es 1 certificado activo por
  termocupla).
- Ordenar la hoja por tiempo con un clic cuando el aviso de «tiempo
  desordenado» aparece (hoy sólo avisa).
- Informe de estudio completo en un solo PDF (hoy el informe es por
  corrida).
