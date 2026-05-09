FROM debian:13-slim

WORKDIR /app

# Install dependencies
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
RUN bun install

# Copy TypeScript source files
COPY tsconfig.bot.json ./
COPY src/bot ./src/bot
COPY src/lib ./src/lib

# Build the bot
RUN echo "Building TypeScript..." && \
    echo "TypeScript version:" && ./node_modules/.bin/tsc --version && \
    echo "Running tsc compiler..." && \
    ./node_modules/.bin/tsc -p tsconfig.bot.json 2>&1 || (echo "TSC FAILED WITH ERROR:" && exit 1) && \
    echo "Build completed - checking dist directory..." && \
    (test -d dist && echo "✓ dist/ directory created" && find dist -type f -name "*.js" | head -5) || \
    (echo "✗ ERROR: dist/ directory not found even though tsc succeeded" && ls -laR . && exit 1)

# Create data directory
RUN mkdir -p /app/data api-logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD mise exec node -- -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) process.exit(1)})" || exit 1

# Start the bot with Mise
CMD ["mise", "run", "start"]
