# HomeFlix web as a container: the Vite build, served by nginx, which also
# forwards /api and /health to the backend so the app and the API share one
# origin (the session cookie just works, no CORS).
#
#   docker build -t homeflix-web:local .
#   docker run -p 3000:8080 -e HOMEFLIX_API=http://homeflix-backend:8005 homeflix-web:local
#
# The backend's compose file (lucaschf/homeflix) builds and runs this next to it.

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
RUN yarn build

# Unprivileged nginx: runs as uid 101 and listens on 8080, so the container
# needs no root and no capabilities.
FROM nginxinc/nginx-unprivileged:1.27-alpine
# Where the API is, as seen from this container. Read at start by the image's
# envsubst step, which renders templates/*.template into conf.d; the filter keeps
# it to HOMEFLIX_* so no other variable in the environment can touch the config.
ENV HOMEFLIX_API=http://backend:8005 \
    NGINX_ENVSUBST_FILTER=^HOMEFLIX_
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
