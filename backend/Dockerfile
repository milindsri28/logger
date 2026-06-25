# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# simple-git shells out to the git binary for clone/fetch/pull
RUN apk add --no-cache git

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY database/migrations /app/database/migrations
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
