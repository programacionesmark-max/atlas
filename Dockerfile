FROM node:22-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000
ENV SERVE_WEB=true
ENV WEB_DIST_PATH=apps/web/dist
ENV DATABASE_DISABLED=true
ENV DATABASE_REQUIRED=false

WORKDIR /app
COPY --from=build /app /app

EXPOSE 10000
CMD ["node", "apps/server/dist/src/index.js"]
