# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY worker/package.json worker/package-lock.json ./
RUN npm ci

COPY worker/tsconfig.json ./
COPY worker/src ./src
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY worker/package.json worker/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

CMD ["node", "dist/index.js"]
