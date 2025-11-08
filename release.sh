#!/bin/bash

# release.sh — Nexicore-style release hygiene for npm packages

set -e
 
if ! command -v pnpm &> /dev/null; then
    echo "ℹ️ pnpm not found. Installing it globally with npm..."
    npm install -g pnpm
    echo "✅ pnpm installed successfully."
fi

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ No version specified. Usage: ./release.sh v1.1.0"
  exit 1
fi

echo "🔍 Checking for uncommitted changes..."
if [[ -n $(git status --porcelain) ]]; then
  echo "❌ Uncommitted changes detected. Please commit or stash before releasing."
  exit 1
fi

echo "📦 Verifying package.json version..."
PKG_VERSION=$(node -p "require('./package.json').version")
if [[ "$PKG_VERSION" != "${VERSION#v}" ]]; then
  echo "❌ package.json version ($PKG_VERSION) does not match tag version (${VERSION#v})"
  exit 1
fi

echo "📝 Verifying changelog..."
if ! grep -q "$VERSION" CHANGELOG.md; then
  echo "❌ CHANGELOG.md does not contain $VERSION"
  exit 1
fi

echo "✅ All checks passed. Tagging release..."
echo "🔍 Checking if tag $VERSION already exists..."
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  TAG_COMMIT=$(git rev-parse "$VERSION")
  HEAD_COMMIT=$(git rev-parse HEAD)

  if [[ "$TAG_COMMIT" == "$HEAD_COMMIT" ]]; then
    echo "ℹ️ Tag $VERSION already exists and points to the current commit. Skipping tag creation."
  else
    echo "❌ Tag $VERSION exists but points to a different commit."
    read -p "Would you like to recreate the tag pointing to the current commit? (y/N): " CONFIRM
    if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
      git tag -d "$VERSION"
      git push origin :refs/tags/"$VERSION"
      git tag "$VERSION"
      git push origin "$VERSION"
      echo "✅ Tag $VERSION created."
      CONFIRM=""
    else
      echo "ℹ️ Skipping tag creation."
      CONFIRM=""
        read -p "Continue to building and publishing? (y/N): " CONFIRM
      if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
        echo "ℹ️ proceeding to building and publishing..."
      else
        exit 1
      fi
    fi
    CONFIRM=""
  fi
else
  echo "✅ Tag $VERSION does not exist. Creating it now..."
  git tag "$VERSION"
  git push origin "$VERSION"
fi


echo "🛠 Building package..."
pnpm build

echo "🔐 Verifying npm login status..."
if ! npm whoami > /dev/null 2>&1; then
  echo "ℹ️ You are not logged into npm. Please follow the prompts to log in."
  npm adduser
  if ! npm whoami > /dev/null 2>&1; then
    echo "❌ npm login failed. Please try again."
    exit 1
  fi
fi

LOGGED_IN_USER=$(npm whoami)
echo "✅ Logged in as '$LOGGED_IN_USER'."

echo "� Ready to publish to npm"
read -p "Publish to npm now? (y/N): " CONFIRM
if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
  pnpm publish --access public
  echo "🎉 Published $VERSION to npm"
else
  echo "🛑 Skipped npm publish"
fi