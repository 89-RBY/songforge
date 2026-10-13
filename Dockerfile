# Production image: the web app (next start) and the worker (npm run worker) use the same image.
# Untested in the development sandbox (no Docker daemon there): build and run it once on the target server.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
# Local audio storage writes under .data: the directory must belong to the unprivileged user.
RUN mkdir -p /app/.data/audio && chown -R node:node /app/.data
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
