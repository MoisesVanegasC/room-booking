# 🏢 Room Reservation System

Sistema web de gestión de reservas de salas con control de concurrencia
a nivel de base de datos, autenticación JWT y reglas de negocio
robustas.

------------------------------------------------------------------------

## 🚀 Características

-   Autenticación y autorización con JWT
-   Roles: `USER` y `ADMIN`
-   Creación de reservas con validación de traslapes
-   Cancelación con ventana mínima configurable (2 horas antes)
-   Check-in y Check-out controlados por reglas de tiempo
-   Prevención de conflictos concurrentes a nivel de base de datos
-   Arquitectura en capas (Controller → Service → Prisma → PostgreSQL)

------------------------------------------------------------------------

## 🧠 Arquitectura

**Backend** - Node.js - Express - TypeScript - Prisma ORM - PostgreSQL

**Base de datos** - Uso de `EXCLUDE USING gist` para evitar traslapes -
Constraints parciales para considerar solo reservas activas

------------------------------------------------------------------------

## 🔒 Control de Traslapes (Nivel Base de Datos)

``` sql
EXCLUDE USING gist (
  "roomId" WITH =,
  tsrange("startAt","endAt",'[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED','IN_PROGRESS'));
```

------------------------------------------------------------------------

## 📂 Estructura del Proyecto

``` bash
backend/
 ├── src/
 │    ├── modules/
 │    ├── config/
 │    ├── middlewares/
 │    ├── routes.ts
 │    └── server.ts
 ├── prisma/
 │    ├── schema.prisma
 │    └── migrations/
 ├── Dockerfile
 ├── docker-compose.yml
 └── package.json
```

------------------------------------------------------------------------

## ⚙️ Variables de Entorno

Crear un archivo `.env`:

``` env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rooms_db
JWT_SECRET=supersecretkey
PORT=3000
```

------------------------------------------------------------------------

## 🖥️ Ejecución Local

``` bash
npm install
npx prisma migrate dev
npm run dev
```

Servidor disponible en:

    http://localhost:3000

------------------------------------------------------------------------

## 🐳 Ejecución con Docker

### Levantar contenedores

``` bash
docker-compose up --build
```

### Ejecutar migraciones en producción

``` bash
docker exec -it rooms_backend npx prisma migrate deploy
```

------------------------------------------------------------------------

## 🛠️ Comandos Útiles

### Resetear base de datos (desarrollo)

``` bash
npx prisma migrate reset
```

### Crear migración manual

``` bash
npx prisma migrate dev --name update_constraint --create-only
```

------------------------------------------------------------------------
