# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN npm install -g pnpm && apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
COPY packages/cli/package.json ./packages/cli/
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM deps AS build

COPY packages/ ./packages/

RUN pnpm --filter @notes/db build
RUN pnpm --filter @notes/api build
RUN pnpm --filter @notes/web build

# ── Stage 3: Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Copy node_modules (includes native better-sqlite3 binaries)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /app/packages/api/node_modules ./packages/api/node_modules

# Copy built artifacts
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/api/dist ./packages/api/dist

# Web app served as static files
COPY --from=build /app/packages/web/dist ./packages/api/public

# Package manifests (needed for Node module resolution)
COPY package.json pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
