# Building with Podman

If Docker is not available on your system, you can use **Podman** instead. Podman is a drop-in replacement for Docker with identical command syntax.

## Installation

### macOS

```bash
brew install podman
podman machine init
podman machine start
```

### Linux

```bash
# Debian/Ubuntu
sudo apt-get install podman

# RHEL/CentOS/Fedora
sudo yum install podman
```

## Building with Podman

### Build the Image

```bash
# Build locally
podman build -t idle-code-redeemer .

# Or with a specific tag
podman build -t idle-code-redeemer:v1.0.0 .
```

### Running with Podman Compose

1. Install `podman-compose`:

```bash
# macOS
brew install podman-compose

# Linux - install from pip
sudo pip3 install podman-compose
```

2. Use the docker-compose file:

```bash
# Copy and configure
cp docker-compose.example.yml docker-compose.yml
export DISCORD_TOKEN=your_bot_token_here

# Start the bot
podman-compose up -d

# View logs
podman-compose logs -f idle-code-redeemer

# Stop the bot
podman-compose down
```

## Key Differences from Docker

- **Command syntax** - identical to Docker
- **Image names** - same naming conventions
- **Volume mounting** - same as Docker
- **Networking** - uses podman networks (created automatically by podman-compose)

## Troubleshooting

### Podman Daemon Not Running (macOS)

```bash
podman machine start
```

### Permission Issues (Linux)

```bash
# Either use sudo or add your user to the podman group
sudo usermod -aG podman $USER
# Log out and back in for group changes to take effect
```

### Building with Buildx (Advanced)

Podman also supports advanced build features:

```bash
podman build --platform linux/amd64,linux/arm64 -t idle-code-redeemer .
```

## Environment Variables

The `.env` file configuration works the same as with Docker:

```bash
export DISCORD_TOKEN=your_bot_token_here
export DISCORD_GUILD_ID=optional_guild_id
export DISCORD_CHANNEL_ID=optional_channel_id
```

Or add them to your `docker-compose.yml` (or `.env` file if using podman-compose).
