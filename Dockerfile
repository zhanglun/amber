FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/core/package.json packages/core/
COPY packages/adapters/package.json packages/adapters/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/

EXPOSE 7788

CMD ["npx", "tsx", "packages/cli/src/main.ts", "web", "serve", "--port=7788"]
