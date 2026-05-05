# Reissulla

A weather, travel, and map application that combines real-time weather data, Finnish public transit information, and interactive maps into a single daily-use tool.

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript
- **Backend:** Fastify, TypeScript
- **Database:** PostgreSQL + PostGIS
- **Cache:** Redis
- **Maps:** Leaflet + OpenStreetMap
- **Monorepo:** Turborepo + pnpm

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker Desktop
- Git

## Getting Started

```bash
git clone https://github.com/Jhoneagle/Reissulla.git
cd Reissulla
pnpm install
docker compose up -d
pnpm dev
```

The web app runs at http://localhost:5173 and the API at http://localhost:3000.

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | Start all apps in development mode |
| `pnpm build`      | Build all packages                 |
| `pnpm lint`       | Lint all packages                  |
| `pnpm format`     | Format code with Prettier          |
| `pnpm type-check` | Type-check all packages            |
| `pnpm test`       | Run all tests                      |

## Project Structure

```
apps/
  web/          React frontend (Vite)
  api/          Fastify backend
packages/
  shared/       Shared types and utilities
  api-client/   Typed HTTP client for the backend
```

## License

[MIT](LICENSE)

## Attributions

- Map data by [OpenStreetMap](https://www.openstreetmap.org/) contributors
- Weather data by [Open-Meteo](https://open-meteo.com/)
- Transit data by [Digitransit](https://digitransit.fi/)
