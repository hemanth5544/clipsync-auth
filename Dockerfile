# Build stage
FROM node:18-slim AS base

# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Copy all source files
COPY . .

# Install dependencies
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile || pnpm install

# Build stage
FROM base AS builder

WORKDIR /app

# Set build environment
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

# Provide dummy DATABASE_URL for build (Next.js needs it during build-time analysis)
# Railway will provide the real DATABASE_URL at runtime
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma client
RUN pnpm prisma:generate

# Ensure public directory exists (create empty if it doesn't)
RUN mkdir -p /app/public

# Build Next.js app
RUN pnpm build

# Production stage
FROM node:18-slim AS runner

# Install system dependencies for runtime (openssl for Prisma)
RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
# Set HOSTNAME to 0.0.0.0 so Next.js binds to all interfaces (required for Railway)
ENV HOSTNAME=0.0.0.0
# Default PORT (Railway will override this with its own PORT env var)
ENV PORT=3001

# Copy the standalone output from builder
# Next.js standalone includes all dependencies and server.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Copy public directory (will be empty if no public files exist)
COPY --from=builder /app/public ./public

# Copy startup script
COPY start-server.js ./

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start the Next.js server using our startup script
# This ensures it binds to 0.0.0.0 and uses Railway's PORT
CMD ["node", "start-server.js"]
