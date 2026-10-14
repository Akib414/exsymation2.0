# Alpine for smaller production image.
# Stage 1: resolve + install prod-only deps from the committed lockfile.
FROM node:22-alpine AS deps

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: lean runtime — prod deps + source only, non-root.
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node server/package.json server/server.js ./
COPY --chown=node:node server/src ./src

USER node

# Only port the app listens on.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["npm", "start"]
