#!/usr/bin/env bash
# CodeGuard E2E acceptance checklist (manual + curl helpers)
set -euo pipefail

API="${API_BASE_URL:-http://localhost:3001/api/v1}"
ROOT="${API_BASE_URL:-http://localhost:3001}"

echo "== Health =="
curl -sf "$ROOT/api/health" | tee /tmp/cg-health.json
echo

echo "== Login =="
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@codeguard.local","password":"Admin123!"}')
echo "login response ok (token redacted)"
TOKEN=$(node -e "const j=JSON.parse(process.argv[1]); console.log((j.data||j).accessToken)" "$LOGIN")
echo
echo "token acquired (not printed)"

echo "== Projects =="
curl -sf "$API/projects" -H "Authorization: Bearer $TOKEN" | head -c 300
echo

echo "== Stats overview =="
curl -sf "$API/stats/overview?range=7d" -H "Authorization: Bearer $TOKEN"
echo

echo "== Reviews =="
curl -sf "$API/reviews?page=1&pageSize=5" -H "Authorization: Bearer $TOKEN" | head -c 300
echo

cat <<'EOF'

Manual steps remaining:
1. Create/update a Project with a real GitHub/GitLab accessToken
2. Configure webhook URL + secret on the Git platform
3. Upload a guideline Markdown under /knowledge-base
4. Open a PR containing intentional SQL injection
5. Confirm PR comment + verdict REJECTED, ruleTitle populated, dashboard TopN updates
EOF
