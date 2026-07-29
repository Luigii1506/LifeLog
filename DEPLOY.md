# Despliegue

## Variables de entorno en Vercel

La integración con Neon inyecta la cadena de conexión sola. Falta una:

    AUTH_PASSPHRASE = una frase larga, la tuya

Sin ella el middleware rechaza todo y no podrás entrar ni tú. Con ella, la URL
queda cerrada para todos los demás — que es el punto (ADR-113).

## Qué pasa en cada despliegue

    prisma generate      genera el cliente
    prisma migrate deploy aplica las migraciones pendientes
    next build           construye

Las tablas se crean solas en el primer despliegue. No hay que entrar a Neon a
ejecutar nada.

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

Los que tocan base necesitan un Postgres aparte:

    docker run -d -p 5433:5432 -e POSTGRES_PASSWORD=test postgres:16
    export TEST_DATABASE_URL="postgres://postgres:test@localhost:5433/postgres"
    npm test

Sin `TEST_DATABASE_URL` se saltan con aviso y corren solo los 62 de lógica pura.
