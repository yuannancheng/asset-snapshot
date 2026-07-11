#!/usr/bin/env bash
set -euo pipefail

# Generate release notes from git history between tags.
# Required env: TAG (current tag), REPO (owner/name), GH_TOKEN
# Optional env: PREV_TAG (prior tag; auto-detected if unset)
# Usage: gen-release-notes.sh <output-file>

OUTPUT_FILE="${1:-/dev/stdout}"

TAG="${TAG:?TAG is required}"
REPO="${REPO:?REPO is required}"
GH_TOKEN="${GH_TOKEN:?GH_TOKEN is required}"

# Detect previous tag if not provided
if [ -z "${PREV_TAG:-}" ]; then
  PREV_TAG=$(git tag --sort=-v:refname | grep -vFx "$TAG" | head -1)
fi

# Collect commit SHAs since previous tag
if [ -z "$PREV_TAG" ]; then
  SHAS=$(git log --pretty=format:"%H" --no-merges)
else
  SHAS=$(git log --pretty=format:"%H" --no-merges "${PREV_TAG}..HEAD")
fi

if [ -z "$SHAS" ]; then
  echo "Release $TAG" > "$OUTPUT_FILE"
  exit 0
fi

{
  echo "## Changes"
  echo ""

  while IFS= read -r sha; do
    [ -z "$sha" ] && continue
    SUBJECT=$(git log -1 --pretty=format:"%s" "$sha")
    SHORT=$(git log -1 --pretty=format:"%h" "$sha")

    # Resolve GitHub login for commit author
    LOGIN=$(gh api "repos/${REPO}/commits/${sha}" --jq '.author.login // empty' 2>/dev/null)
    if [ -z "$LOGIN" ]; then
      AUTHOR_EMAIL=$(git log -1 --pretty=format:"%ae" "$sha")
      LOGIN=$(gh api "search/users?q=${AUTHOR_EMAIL}+in:email" --jq '.items[0].login // empty' 2>/dev/null)
    fi
    if [ -z "$LOGIN" ]; then
      LOGIN=$(git log -1 --pretty=format:"%an" "$sha")
    fi

    echo "- ${SUBJECT} ([${SHORT}](https://github.com/${REPO}/commit/${sha})) by @${LOGIN}"
  done <<< "$SHAS"

  if [ -n "$PREV_TAG" ]; then
    echo ""
    echo "**Full Changelog**: [${PREV_TAG}...${TAG}](https://github.com/${REPO}/compare/${PREV_TAG}...${TAG})"
  fi
} > "$OUTPUT_FILE"
