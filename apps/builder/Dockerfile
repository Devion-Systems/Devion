FROM oven/bun:1.3.14-alpine AS install
WORKDIR /app
COPY package.json ./
RUN bun install --production

FROM moby/buildkit:v0.25.2-rootless AS buildkit-client

FROM oven/bun:1.3.14-alpine
RUN apk add --no-cache git ca-certificates bash
COPY --from=buildkit-client /usr/bin/buildctl /usr/local/bin/buildctl
WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY . .
USER bun
EXPOSE 3010
CMD ["bun", "src/api.ts"]
