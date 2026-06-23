FROM node:22-alpine
WORKDIR /app

# Copiar arquivos do workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/afd/package.json ./packages/afd/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

RUN pnpm --filter @qick/db generate
RUN pnpm --filter api build

EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
