# Despliegue

## vercel.json

El framework se declara en el repositorio, no en el panel.

Vercel no detectó el proyecto como Next.js y construyó la raíz como si fueran
archivos estáticos: despliegues «Ready» de 0 ms que servían 404 en todas las
rutas. Verde en el panel, vacío en realidad.

Declararlo aquí lo hace reproducible y a prueba de que alguien toque un
desplegable por error.

## Variables de entorno en Vercel

La integración con Neon inyecta la cadena de conexión sola. Falta una:

    AUTH_PASSPHRASE = una frase larga, la tuya

Sin ella el middleware rechaza todo y no podrás entrar ni tú. Con ella, la URL
queda cerrada para todos los demás — que es el punto (ADR-113).

## Qué pasa en cada despliegue

    prisma generate   genera el cliente (no necesita base)
    next build        construye

**Las migraciones NO van en el build, a propósito.** `prisma migrate deploy`
necesita conectarse, y la integración de Neon no siempre expone la cadena en
la fase de construcción — cuando no lo hace, tumba el despliegue entero con un
error que no dice nada útil. Además una caída momentánea de la base rompería
un despliegue que por lo demás está bien.

## Migraciones, cuando cambie el esquema

Desde tu máquina, con el `.env` puesto:

    npm run db:deploy

Aplícalas ANTES de desplegar: el código nuevo espera las tablas nuevas.

## Siembra inicial, una sola vez

Los catálogos no se siembran en el build a propósito: son datos, no esquema, y
acoplarlos al despliegue significa que un cambio de catálogo obliga a
redesplegar.

Con la cadena de Neon en tu `.env` local:

    npm run db:seed:all

Siembra 14 contratos de evento, 29 alimentos y 63 ejercicios. Es idempotente:
correrlo dos veces no duplica nada.

## Desarrollo local

Copia `.env.example` a `.env` y pon la misma cadena de Neon. Local y
producción comparten base a propósito: es tu vida, es un solo conjunto de
datos, y mantener dos bases sincronizadas a mano es una fuente de errores que
no compensa para un solo usuario.

## Tests

Los que tocan base necesitan **otra base**, no otro schema.

Se intentó aislar con `?schema=test_xxx` en la misma cadena. **No funciona:** el
adaptador serverless de Neon ignora ese parámetro. Los tests corrieron contra
`public` y borraron 29 alimentos y 63 ejercicios de producción, mientras los
schemas `test_*` se creaban vacíos dando falsa impresión de aislamiento.

Ahora `global-setup.ts` compara host y nombre de base, y **se niega a arrancar**
si coinciden.

Opciones:

    # Rama de Neon (gratis, sin Docker)
    # Neon → Branches → New branch → copia su cadena
    export TEST_DATABASE_URL="postgresql://…/neondb?sslmode=require"

    # O Postgres local
    docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16
    export TEST_DATABASE_URL="postgres://postgres:test@localhost:5433/postgres"

    npm test

Sin `TEST_DATABASE_URL` se saltan con aviso y corren los 62 de lógica pura.
