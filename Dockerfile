FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV DATABASE_URL=file:../data/baddel.db
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run db:generate && npm run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "scripts/launch.mjs"]
