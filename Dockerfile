# Builder stage
FROM debian:13.4-slim AS builder

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

# Install Mise
RUN curl https://mise.run | sh

# Copy configuration files for Mise and project
COPY .mise.toml ./
COPY package.json ./
COPY .env.example .env

# Trust the .mise.toml configuration file
RUN mise trust

# Install tools and dependencies via Mise
RUN mise install

# Install npm/bun dependencies (includes TypeScript and other devDependencies)
RUN mise run install

# Copy TypeScript source files
COPY tsconfig.bot.json ./
COPY src/bot ./src/bot
COPY src/lib ./src/lib

# Build the bot
RUN mise run build

# Production stage
FROM debian:13.4-slim AS production

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update \
  && apt-get -y --no-install-recommends install \
    ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Disable SSL cert validation for Idle Champions API (expired certificate)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy built artifacts and necessary files from builder
COPY --from=builder /app/.mise ./.mise
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.env .env

# Create data and logs directories
RUN mkdir -p /app/data api-logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the bot
CMD ["node", "dist/bot/index.js"]
