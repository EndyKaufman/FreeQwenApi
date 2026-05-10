#!/bin/bash

# Docker Build & Push Script with Full Metadata
# Usage: ./docker-build-push.sh [tag]

set -e

# Configuration
DOCKER_USERNAME="endykaufman"
IMAGE_NAME="qwen-api-proxy"
TAG=${1:-"latest"}
FULL_IMAGE="${DOCKER_USERNAME}/${IMAGE_NAME}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Docker Build & Push with Metadata${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
DESCRIPTION=$(node -p "require('./package.json').description")

echo -e "${YELLOW}📦 Image:${NC} ${FULL_IMAGE}"
echo -e "${YELLOW}🏷️  Tag:${NC} ${TAG}"
echo -e "${YELLOW}📝 Version:${NC} ${VERSION}"
echo ""

# Step 1: Login to Docker Hub
echo -e "${BLUE}🔐 Step 1: Login to Docker Hub${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker не запущен. Запустите Docker и попробуйте снова.${NC}"
    exit 1
fi

if ! docker info 2>&1 | grep -q "Username"; then
    echo -e "${YELLOW}Введите логин и пароль Docker Hub:${NC}"
    docker login
fi
echo ""

# Step 2: Build image with metadata
echo -e "${BLUE}🔨 Step 2: Building Docker image...${NC}"
docker buildx build --platform linux/amd64,linux/arm64 \
    --tag "${FULL_IMAGE}:${TAG}" \
    --tag "${FULL_IMAGE}:${VERSION}" \
    --label "org.opencontainers.image.title=FreeQwenApi" \
    --label "org.opencontainers.image.description=${DESCRIPTION}" \
    --label "org.opencontainers.image.url=https://github.com/EndyKaufman/FreeQwenApi" \
    --label "org.opencontainers.image.source=https://github.com/EndyKaufman/FreeQwenApi" \
    --label "org.opencontainers.image.documentation=https://github.com/EndyKaufman/FreeQwenApi/blob/main/README.md" \
    --label "org.opencontainers.image.vendor=EndyKaufman" \
    --label "org.opencontainers.image.licenses=MIT" \
    --label "org.opencontainers.image.version=${VERSION}" \
    --label "org.opencontainers.image.revision=$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
    --label "org.opencontainers.image.created=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --push \
    .

echo ""
echo -e "${GREEN}✅ Image built and pushed successfully!${NC}"
echo ""

# Step 3: Push README to Docker Hub (optional, requires docker-buildx with annotations)
echo -e "${BLUE}📖 Step 3: Pushing README to Docker Hub...${NC}"
echo -e "${YELLOW}⚠️  Для автоматической загрузки README используйте один из методов:${NC}"
echo ""
echo -e "${BLUE}Метод 1: Docker Hub (вручную)${NC}"
echo -e "   1. Откройте https://hub.docker.com/repository/docker/${DOCKER_USERNAME}/${IMAGE_NAME}"
echo -e "   2. Перейдите в 'Manage Repository' > 'Description'"
echo -e "   3. Вставьте содержимое README.md в поле 'Full Description'"
echo -e "   4. Сохраните"
echo ""
echo -e "${BLUE}Метод 2: Docker CLI (автоматически)${NC}"
echo -e "   Установите docker-push-readme:"
echo -e "   ${YELLOW}npm install -g docker-push-readme${NC}"
echo -e "   ${YELLOW}docker-push-readme -u ${DOCKER_USERNAME} -r ${IMAGE_NAME} README.md${NC}"
echo ""
echo -e "${BLUE}Метод 3: GitHub Actions (автоматически при пуше)${NC}"
echo -e "   Создайте .github/workflows/docker.yml с action peter-evans/dockerhub-description"
echo ""

# Step 4: Show image info
echo -e "${BLUE}📊 Image Information:${NC}"
echo -e "   ${GREEN}Image:${NC} ${FULL_IMAGE}:${TAG}"
echo -e "   ${GREEN}Version:${NC} ${FULL_IMAGE}:${VERSION}"
echo -e "   ${GREEN}Pull command:${NC} docker pull ${FULL_IMAGE}:${TAG}"
echo -e "   ${GREEN}Run command:${NC} docker run -d -p 3264:3264 ${FULL_IMAGE}:${TAG}"
echo ""
echo -e "${BLUE}🔗 Links:${NC}"
echo -e "   ${GREEN}Docker Hub:${NC} https://hub.docker.com/r/${DOCKER_USERNAME}/${IMAGE_NAME}"
echo -e "   ${GREEN}GitHub:${NC} https://github.com/EndyKaufman/FreeQwenApi"
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Done!${NC}"
echo -e "${GREEN}========================================${NC}"
