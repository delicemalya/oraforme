#!/usr/bin/env bash
# scripts/semgrep.sh — Semgrep scan local (open-source uniquement, sans Pro)
#
# Usage :
#   bash scripts/semgrep.sh          # scan complet
#   bash scripts/semgrep.sh --json   # sortie JSON
#   bash scripts/semgrep.sh --quiet  # erreurs uniquement
#
# Prérequis : pip install semgrep   (ou brew install semgrep sur macOS)
# PAS de SEMGREP_APP_TOKEN → mode offline, pas de télémétrie Pro

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EXTRA_FLAGS=()
for arg in "$@"; do
  EXTRA_FLAGS+=("$arg")
done

echo "🔍 Semgrep OSS — open-source rules only (no Pro engine)"
echo "   Projet : $ROOT"
echo ""

semgrep \
  --config .semgrep.yml \
  --config p/typescript \
  --config p/javascript \
  --config p/react \
  --config p/nextjs \
  --config p/security-audit \
  --config p/owasp-top-ten \
  --config p/jwt \
  --config p/secrets \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude "coverage" \
  --exclude "test-results" \
  --exclude "**/*.test.ts" \
  --exclude "**/*.spec.ts" \
  --exclude "**/*.test.tsx" \
  --exclude "**/*.spec.tsx" \
  --exclude "supabase/migrations" \
  --metrics=off \
  "${EXTRA_FLAGS[@]}" \
  .

echo ""
echo "✅ Scan terminé."
