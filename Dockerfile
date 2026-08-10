FROM node:24.18.0-alpine3.24 AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate && pnpm install --frozen-lockfile

COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./tsconfig.json
COPY server/tsconfig.json ./server/tsconfig.json

RUN pnpm build:api

FROM node:24.18.0-alpine3.24 AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate && pnpm install --prod --frozen-lockfile

COPY --from=build /app/server/dist ./server/dist

USER node
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/dist/server/index.js"]
