# Client production image: Vite build -> nginx static serve with SPA fallback.
# Same-origin API access: leave VITE_API_BASE empty so the browser calls /api
# on the same host, which the outer nginx proxies to the app (no CORS).
# Stage 1: install + build from the committed lockfile.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src

ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# Stage 2: lean static server — dist + SPA fallback only, non-root.
FROM nginx:1.29-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
