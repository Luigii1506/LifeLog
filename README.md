# LifeLog

Capa de captura de **LifeOS**.

Obsidian es excelente para pensar y documentar, pero es una mala interfaz para
capturar datos repetitivos. No se abre una nota para registrar cada serie de
gimnasio, cada comida o cada gasto. LifeLog es esa interfaz; Obsidian conserva
el conocimiento y la base de datos guarda los registros.

```
LifeLog  →  Database  →  brain-ops  →  Vault local  →  Obsidian Sync
```

## Arquitectura

Gobernada por `09 - Vida/00 - Arquitectura/` en el Obsidian Vault. Los ADR y las
invariantes que se citan en el código viven ahí.

| Decisión | Qué fija |
|---|---|
| **ADR-109** | Columna vertebral de eventos + tablas relacionales para dominios profundos |
| **ADR-110** | LifeLog es dueño de este esquema. brain-ops **lee** y no migra. |
| **ADR-107** | Contenido en español; identificadores técnicos en inglés ASCII |

### El modelo

```
                        events
                 columna vertebral
            línea de tiempo unificada
              + dominios ligeros
                        ▲
                        │  un evento resumen
                        │  al cerrar la sesión
          ┌─────────────┴─────────────┐
   Exercise                       Food
   WorkoutRoutine                 Recipe
   WorkoutSession                 RecipeIngredient
   ExerciseSet                    Meal / MealItem
```

**Regla para clasificar un dominio nuevo:**

> ¿La interfaz necesita consultar el histórico estructurado para funcionar?

- **Sí** → dominio profundo: tablas relacionales + evento resumen. Cuesta
  esquema; debe ser raro.
- **No** → dominio ligero: solo eventos. Añadirlo no toca `schema.prisma`.

Gimnasio es profundo porque muestra la sesión anterior mientras registras.
«Fui a un lugar» o «tomé la medicina» son ligeros y nunca merecerán una tabla.

### Invariantes que hace cumplir el código

| | |
|---|---|
| **I-02** | `events` es append-only. Trigger SQL bloquea `UPDATE` y `DELETE`. Corregir = `revoke()`. |
| **I-05** | LifeLog **nunca** escribe en el vault. Solo brain-ops. |
| **I-10** | Idempotencia por `eventUid` (ULID). Reimportar no duplica. |
| **I-11** | Todo dominio profundo emite su evento resumen al cerrar la sesión. |
| **I-12** | Un dueño por recurso: el esquema es de LifeLog, el vault es de brain-ops. |

## Stack

Next.js 16 · React 19 · Prisma 7 · SQLite (WAL) · Tailwind 4 · Zod · ULID

SQLite hasta que exista una razón medible para Postgres: escritura concurrente
real desde varios dispositivos, acceso remoto, o búsqueda vectorial que SQLite
no sostenga (ADR-106).

## Desarrollo

```bash
npm run dev          # http://localhost:3000
npx prisma studio    # inspeccionar la base
npx prisma migrate dev --name <nombre>
```

La base vive en `data/lifelog.db` y no se versiona.

## Estado

| Módulo | Estado |
|---|---|
| Esquema + migraciones + trigger append-only | Hecho |
| Capa de eventos (emit, revoke, idempotencia, timeline) | Hecho |
| **Today** — registro rápido + línea de tiempo | Hecho |
| **Gym** — rutinas, sesión anterior, series | Pendiente |
| **Food** — alimentos, recetas, comidas | Pendiente |
| Proyecciones (`DailyMetric`, `EntityStat`) | Pendiente |
| Generador de Markdown (en brain-ops) | Pendiente |

### Criterio de aceptación

> Durante **30 días** registré sueño, gimnasio, alimentación y actividades con
> menos de **2 minutos** de fricción al día.

No es un objetivo blando. El dominio personal de brain-ops ya se construyó una
vez, con tests, y quedó con 3 filas de datos reales: el fallo no fue técnico,
fue que nunca se usó. Hasta cumplir ese criterio no se construye nada más.

## Notas de implementación

- **`occurredAt` vs `recordedAt`** — se registra el desayuno a las 23:00. Sin
  esa separación, todo análisis por hora del día queda inservible.
- **Prisma guarda `DateTime` como texto ISO-8601** en SQLite. Sembrar datos a
  mano con enteros epoch o con `'YYYY-MM-DD HH:MM:SS'` produce filas que la
  aplicación no encuentra.
- **`MealItem.name` está desnormalizado a propósito** — permite registrar algo
  que no está en `Food` sin obligar a crear la entidad primero. La fricción mata
  el registro.
