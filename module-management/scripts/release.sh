#!/bin/bash
set -e

# MoLOS Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

TYPE=${1:-patch}

echo "🚀 Starting MoLOS release process ($TYPE)..."

# Ensure we are on main branch and up to date
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: You must be on the 'main' branch to release."
    exit 1
fi

git pull origin main

# 1. Bump version in package.json
echo "📦 Bumping version..."
npm version $TYPE --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ New version: v$NEW_VERSION"

# 2. Update CHANGELOG.md (Simple implementation)
echo "📝 Updating CHANGELOG.md..."
DATE=$(date +%Y-%m-%d)
echo -e "## [$NEW_VERSION] - $DATE\n\n### Changed\n- Production deployment readiness\n- Security updates for modules\n- Docker and Kubernetes support\n\n$(cat CHANGELOG.md 2>/dev/null || echo "")" > CHANGELOG.md

# 3. Commit and Tag
echo "💾 Committing and tagging..."
git add package.json CHANGELOG.md
git commit -m "chore(release): v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 4. Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

echo "🎉 Release v$NEW_VERSION successfully pushed!"
echo "GitHub Actions will now build and publish the Docker image to GHCR."