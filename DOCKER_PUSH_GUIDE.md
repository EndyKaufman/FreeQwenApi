# Docker Build & Push Guide

## 🚀 Quick Start

### Option 1: Automated Script (Recommended)

```bash
# Build and push with latest tag
./docker-build-push.sh

# Build and push with custom tag
./docker-build-push.sh v1.0.0
./docker-build-push.sh stable
```

### Option 2: Manual Commands

```bash
# 1. Build with metadata
docker buildx build --platform linux/amd64,linux/arm64 \
    --tag endykaufman/qwen-api-proxy:latest \
    --tag endykaufman/qwen-api-proxy:1.0.18 \
    --label "org.opencontainers.image.title=FreeQwenApi" \
    --label "org.opencontainers.image.description=Free Qwen AI API Proxy" \
    --push \
    .

# 2. Push README (one-time setup)
npm install -g docker-push-readme
docker-push-readme -u endykaufman -r qwen-api-proxy README_DOCKER.md
```

### Option 3: GitHub Actions (Fully Automated)

1. Add secrets to GitHub:
   - `DOCKERHUB_USERNAME` - Your Docker Hub username
   - `DOCKERHUB_TOKEN` - Docker Hub access token

2. Push to main branch or create a tag:
   ```bash
   git push origin main
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. GitHub Actions will automatically:
   - Build for linux/amd64 and linux/arm64
   - Push to Docker Hub with proper tags
   - Update README on Docker Hub

## 📋 Prerequisites

### 1. Docker Buildx (Multi-platform builds)

```bash
# Check if buildx is available
docker buildx version

# Create builder if needed
docker buildx create --name mybuilder --use
docker buildx inspect --bootstrap
```

### 2. Docker Hub Access Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Give it a name (e.g., "FreeQwenApi CI")
4. Set permissions: Read & Write
5. Copy the token

## 🏷️ Metadata Included

All builds include:

- ✅ **Title**: FreeQwenApi
- ✅ **Description**: Full project description
- ✅ **URL**: GitHub repository link
- ✅ **Source**: Source code URL
- ✅ **Documentation**: README link
- ✅ **Vendor**: EndyKaufman
- ✅ **License**: MIT
- ✅ **Version**: From package.json
- ✅ **Git Revision**: Commit hash
- ✅ **Build Date**: Timestamp
- ✅ **Keywords**: qwen, ai, api, proxy, openai, telegram-bot

## 📝 README on Docker Hub

### Manual Method (One-time)

1. Open https://hub.docker.com/repository/docker/endykaufman/qwen-api-proxy
2. Click "Manage Repository" > "Description"
3. Copy contents of README_DOCKER.md
4. Paste into "Full Description"
5. Save

### Automatic Method (GitHub Actions)

Already configured in `.github/workflows/docker.yml`. Updates automatically on every push to main.

### CLI Method

```bash
npm install -g docker-push-readme
docker-push-readme -u endykaufman -r qwen-api-proxy README_DOCKER.md
```

## 🔍 Verify Image

After pushing, verify metadata:

```bash
# Pull and inspect
docker pull endykaufman/qwen-api-proxy:latest
docker inspect endykaufman/qwen-api-proxy:latest

# Check labels
docker inspect --format='{{index .Config.Labels "org.opencontainers.image.title"}}' endykaufman/qwen-api-proxy:latest
docker inspect --format='{{index .Config.Labels "org.opencontainers.image.description"}}' endykaufman/qwen-api-proxy:latest
```

## 📊 Available Tags

The image will be tagged with:

- `latest` - Latest build from main branch
- `1.0.0` - Specific version (from package.json)
- `sha-abc1234` - Git commit SHA
- `main` - Branch name

## 🎯 Example Usage

```bash
# Pull
docker pull endykaufman/qwen-api-proxy:latest

# Run
docker run -d \
  --name qwen-api-proxy \
  -p 3264:3264 \
  -v $(pwd)/session:/app/session \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  --env-file .env \
  endykaufman/qwen-api-proxy:latest

# Check logs
docker logs -f qwen-api-proxy
```

## 🔧 Troubleshooting

### Build fails with "buildx not available"

```bash
docker buildx create --name mybuilder --use
```

### Push fails with "unauthorized"

```bash
docker logout
docker login
```

### Multi-platform build fails

```bash
# Install QEMU for emulation
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
```

## 📚 Additional Resources

- [Docker Buildx Documentation](https://docs.docker.com/build/buildx/)
- [DHub Metadata Specification](https://github.com/opencontainers/image-spec/blob/main/annotations.md)
- [GitHub Actions for Docker](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images)
