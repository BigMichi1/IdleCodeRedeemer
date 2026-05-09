FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with bun
RUN bun install --production

# Copy TypeScript source
COPY tsconfig.bot.json ./
COPY src/bot ./src/bot
COPY src/lib ./src/lib
COPY src/shared ./src/shared

# Build TypeScript with bun
RUN bun run build

# Create data directory
RUN mkdir -p /app/data

# Expose health check (optional, for monitoring)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run --eval "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) process.exit(1)})" || exit 1

# Start the bot
CMD ["bun", "run", "start"]
