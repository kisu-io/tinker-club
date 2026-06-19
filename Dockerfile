# --- deps ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# A throwaway secret so the production build's page-data collection (which loads
# the session module's prod guard) succeeds. The REAL secret is provided at runtime.
ENV SESSION_SECRET=build-time-only-not-used-at-runtime-0000000000000000
# DATABASE_URL is not read at build time (lazy singleton), but set a placeholder
# so any code path that touches it doesn't crash the build.
ENV DATABASE_URL=build-time-only-not-used-at-runtime
RUN npm run build

# --- run ---
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Standalone server + static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/scripts ./scripts
# serverExternalPackages (postgres, bcryptjs) are NOT bundled by Next into the
# standalone output. Copy them from the full node_modules so they're available
# at runtime for dynamic require().
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
# Postgres connection is via DATABASE_URL env var at runtime — no local DB volume.
EXPOSE 3000
CMD ["node", "server.js"]