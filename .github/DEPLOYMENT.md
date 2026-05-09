# GitHub Actions - Docker Build & Deploy

This workflow automatically builds and publishes Docker images to GitHub Container Registry (GHCR) on every push to main and on version tags.

## Features

- ✅ Builds Docker image on push and pull requests
- ✅ Publishes to GitHub Container Registry (GHCR) on main branch and tags
- ✅ Automatic semantic versioning with tags
- ✅ Layer caching for faster builds
- ✅ Deployment job placeholder for custom deployment logic

## How It Works

### Triggers

- **Pull Requests** to `main`: Build only (no publish)
- **Pushes** to `main`: Build & publish with `latest` tag
- **Version Tags** (`v*`): Build & publish with semantic version tags

### Image Naming & Tags

Images are published to: `ghcr.io/YOUR_USERNAME/idle-code-redeemer-bot`

Example tags:
- `main-sha123456` - Commit SHA
- `v2.0.0` - Semantic version
- `2.0` - Major.minor version
- `latest` - Latest from main branch

## Configuration

### 1. Enable GitHub Container Registry Access

The workflow uses `GITHUB_TOKEN` which has automatic access to GHCR. No additional setup needed!

### 2. Pull Image for Local Testing

```bash
# Authenticate with your GitHub account
echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u USERNAME --password-stdin

# Pull the latest image
docker pull ghcr.io/YOUR_USERNAME/idle-code-redeemer-bot:latest

# Or a specific version
docker pull ghcr.io/YOUR_USERNAME/idle-code-redeemer-bot:v2.0.0
```

## Deployment Options

The workflow has a placeholder `deploy` job that runs on main branch and version tags. Choose one of these approaches:

### Option 1: SSH to Server + Docker Compose (Recommended)

Update the `deploy` job to SSH to your server and pull the latest image:

```yaml
deploy:
  name: Deploy to Production
  runs-on: ubuntu-latest
  needs: build
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  
  steps:
    - name: Deploy via SSH
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SSH_HOST }}
        username: ${{ secrets.SSH_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /path/to/idle-code-redeemer
          docker-compose pull
          docker-compose up -d
```

**Setup Required:**
1. Generate SSH key: `ssh-keygen -t ed25519 -f deploy_key`
2. Add public key to server's `~/.ssh/authorized_keys`
3. Add secrets to GitHub:
   - `SSH_HOST`: Your server IP/hostname
   - `SSH_USER`: SSH username
   - `SSH_PRIVATE_KEY`: Private key content

### Option 2: Deploy to Kubernetes

```yaml
deploy:
  name: Deploy to Kubernetes
  runs-on: ubuntu-latest
  needs: build
  
  steps:
    - name: Deploy to K8s
      uses: azure/k8s-deploy@v4
      with:
        namespace: 'production'
        manifests: |
          k8s/deployment.yaml
        images: 'ghcr.io/${{ github.repository }}:latest'
```

### Option 3: Deploy to Container Orchestration Service

Use services like:
- **AWS ECS**: Use `aws-actions/amazon-ecs-deploy-task-definition`
- **Azure Container Instances**: Use `azure/aci-deploy@v1`
- **DigitalOcean App Platform**: Use `digitalocean/app_action@v1.1.0`

## Secrets Setup

### GitHub Secrets (Optional for custom deployment)

1. Go to `Settings → Secrets and variables → Actions`
2. Add required secrets for your chosen deployment method:
   - SSH credentials
   - Cloud provider tokens
   - API keys

## Version Tags

When you create a release/tag:

```bash
git tag -a v2.0.0 -m "Release 2.0.0"
git push origin v2.0.0
```

The workflow will automatically build and tag the image as:
- `ghcr.io/username/idle-code-redeemer-bot:v2.0.0`
- `ghcr.io/username/idle-code-redeemer-bot:2.0.0`
- `ghcr.io/username/idle-code-redeemer-bot:2.0`

## Viewing Builds

1. Go to **Actions** tab on GitHub
2. Select the **Build & Deploy Docker Image** workflow
3. View build logs and status

## Troubleshooting

**Build fails with "permission denied"**
- Check Dockerfile permissions
- Ensure all required files are committed to git

**Image not published to registry**
- Confirm you're on `main` branch or have a version tag
- Check that GITHUB_TOKEN secret is available (automatic)

**Deployment not triggering**
- Verify the branch/tag matches the workflow triggers
- Check the workflow file is in `.github/workflows/` directory

## Next Steps

1. Commit and push this workflow file
2. Create a tag: `git tag -a v2.0.0 -m "Release version" && git push origin v2.0.0`
3. Watch the Actions tab for the build to complete
4. Configure your preferred deployment method from the options above
