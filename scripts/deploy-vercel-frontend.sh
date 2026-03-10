#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/aura/frontend"

cd "${FRONTEND_DIR}"
vercel deploy --prod --force --yes
