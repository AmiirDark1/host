# =============================================
# Multi-Stage Docker Build for WordPress Panel
# =============================================

# ---------- Stage 1: Build React Client ----------
FROM node:22-alpine AS client-builder
WORKDIR /app/client

# Create output directory matching vite.config.js (outDir: '../wordpress-panel/public')
RUN mkdir -p /app/wordpress-panel/public

# Copy package files first for layer caching
COPY client/package*.json ./
RUN npm install

# Copy client source and build
COPY client/ ./
RUN npm run build

# ---------- Stage 2: Build & Run Server ----------
FROM node:22-alpine

WORKDIR /app

# Install Docker CLI so dockerode can talk to the host Docker + curl for IP detection
RUN apk add --no-cache docker-cli curl

# Copy server package files and install dependencies
COPY wordpress-panel/package*.json ./
RUN npm install

# Copy server source files
COPY wordpress-panel/server.js ./
COPY wordpress-panel/dockerManager.js ./
COPY wordpress-panel/resourceLimits.js ./

# Create infrastructure directories for SSL certs (mounted from host via docker-compose)
RUN mkdir -p /app/infrastructure/nginx/certs

# Copy pre-built React client from Stage 1 into the static directory
COPY --from=client-builder /app/wordpress-panel/public ./public

EXPOSE 3000

CMD ["node", "server.js"]