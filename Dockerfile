# Builder stage
FROM debian:13.5-slim@sha256:28de0877c2189802884ccd20f15ee41c203573bd87bb6b883f5f46362d24c5c2 AS builder

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

# Copy configuration files for Mise and project
COPY .mise.toml ./
COPY package.json ./
# bun.lock must be present for the frozen install below; without it the image
# silently resolves fresh versions and drifts from the committed lockfile.
COPY bun.lock ./
COPY .env.example .env
COPY bin/mise ./bin/mise

# No `mise trust` step: bin/mise is the generated bootstrap, which exports
# MISE_TRUSTED_CONFIG_PATHS for the project directory before invoking mise. The
# explicit trust call was therefore a no-op that logged
# "mise WARN  No untrusted config files found." on every build.

# Install tools and dependencies via Mise
RUN bin/mise install

# Install all dependencies (including dev) for building, pinned to the lockfile
RUN bin/mise run ci:install

# Copy TypeScript source files
COPY tsconfig.bot.json ./
COPY src/bot ./src/bot

# Build the production bundle
RUN bin/mise run prod:build

# Production stage — only needs the compiled binary, no Bun or node_modules required
FROM debian:13.5-slim@sha256:28de0877c2189802884ccd20f15ee41c203573bd87bb6b883f5f46362d24c5c2 AS production

WORKDIR /app

# ca-certificates for outbound HTTPS; procps for the pgrep healthcheck below
RUN apt-get update \
  && apt-get -y --no-install-recommends install \
    ca-certificates procps \
  && rm -rf /var/lib/apt/lists/*

# Certificate validation stays ON. If the Idle Champions host is serving an
# expired certificate again, set IDLE_CHAMPIONS_INSECURE_TLS=1 -- that scopes
# the exception to that host's requests instead of disabling validation
# process-wide, which would also cover the Discord gateway and DISCORD_TOKEN.
# ENV IDLE_CHAMPIONS_INSECURE_TLS=1

# Copy the self-contained compiled executable from builder
COPY --from=builder /app/dist-bundle/bot ./dist-bundle/bot

# Copy database migrations (required at runtime for schema setup)
COPY --from=builder /app/src/bot/database/migrations ./dist-bundle/migrations

# Create runtime data + API log directories (logs/ is created by logger.ts at startup)
RUN mkdir -p /app/data /app/api-logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f "dist-bundle/bot" || exit 1

# Run the self-contained executable directly — no Bun, no Node, no mise needed
CMD ["/app/dist-bundle/bot"]
