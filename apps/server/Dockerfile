FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --filter @code-guard/server... --frozen-lockfile=false

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @code-guard/shared build \
 && pnpm --filter @code-guard/server prisma:generate \
 && pnpm --filter @code-guard/server build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/server
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma:migrate && node dist/main.js"]
