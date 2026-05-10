# Builder stage
FROM debian:13.4-slim@sha256:109e2c65005bf160609e4ba6acf7783752f8502ad218e298253428690b9eaa4b AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update \
  && apt-get -y --no-install-recommends install \
    curl git ca-certificates build-essential \
  && rm -rf /var/lib/apt/lists/*

# Configure Mise environment
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV MISE_DATA_DIR="/app/.mise"
ENV MISE_CONFIG_DIR="/app/.mise/config"
ENV MISE_CACHE_DIR="/app/.mise/cache"
ENV MISE_INSTALL_PATH="/usr/local/bin/mise"
ENV PATH="/app/.mise/shims:$PATH"
# Disable SSL cert validation for Idle Champions API (expired certificate)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy configuration files for Mise and project
COPY .mise.toml ./
COPY package.json ./
COPY esbuild.prod.js ./
COPY .env.example .env
COPY bin/mise ./bin/mise

# Trust the .mise.toml configuration file
RUN bin/mise trust

# Install tools and dependencies via Mise
RUN bin/mise install

# Install all dependencies (including dev) for building
RUN bin/mise run install

# Copy TypeScript source files
COPY tsconfig.bot.json ./
COPY src/bot ./src/bot
COPY src/lib ./src/lib

# Build the production bundle
RUN bin/mise run prod:build

# Production stage
FROM debian:13.4-slim@sha256:109e2c65005bf160609e4ba6acf7783752f8502ad218e298253428690b9eaa4b AS production

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update \
  && apt-get -y --no-install-recommends install \
    ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Configure Mise environment
ENV MISE_DATA_DIR="/app/.mise"
ENV MISE_CONFIG_DIR="/app/.mise/config"
ENV MISE_CACHE_DIR="/app/.mise/cache"
ENV PATH="/app/.mise/shims:$PATH"

# Disable SSL cert validation for Idle Champions API (expired certificate)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy built artifacts and necessary files from builder
COPY --from=builder /app/.mise ./.mise
COPY --from=builder /app/bin/mise ./bin/mise
COPY --from=builder /app/dist-bundle ./dist-bundle
COPY --from=builder /app/.mise.toml ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/.env .env

# Install only production dependencies
RUN bin/mise run prod:install

# Create data and logs directories
RUN mkdir -p /app/data api-logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot with production bundle via mise
CMD ["./bin/mise", "run", "prod:start"]
