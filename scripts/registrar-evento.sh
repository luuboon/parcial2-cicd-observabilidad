#!/usr/bin/env bash
# Envía un evento del pipeline a OpenObserve por la API HTTP/JSON (stream "cicd_pipeline").
# Uso: registrar-evento.sh <evento> <resultado> [detalle]
# Variables: O2_URL, O2_USER, O2_PASSWORD y las de GitHub Actions (GITHUB_SHA, GITHUB_REF_NAME, ...).
set -u
EVENTO="$1"; RESULTADO="$2"; DETALLE="${3:-}"
if [ -z "${O2_URL:-}" ] || [ -z "${O2_USER:-}" ] || [ -z "${O2_PASSWORD:-}" ]; then
  echo "OpenObserve no configurado; no se registra el evento $EVENTO"; exit 0
fi
MENSAJE=$(git log -1 --pretty=%s 2>/dev/null | head -c 200 | sed 's/"/\\"/g')
CUERPO=$(cat <<JSON
[{
  "evento": "${EVENTO}",
  "resultado": "${RESULTADO}",
  "detalle": "${DETALLE}",
  "commit": "${GITHUB_SHA:-local}",
  "commit_corto": "$(echo "${GITHUB_SHA:-local}" | cut -c1-7)",
  "mensaje_commit": "${MENSAJE}",
  "rama": "${GITHUB_REF_NAME:-local}",
  "usuario": "${GITHUB_ACTOR:-local}",
  "workflow": "${GITHUB_WORKFLOW:-local}",
  "run_id": "${GITHUB_RUN_ID:-0}",
  "run_numero": "${GITHUB_RUN_NUMBER:-0}",
  "run_url": "${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-0}",
  "pruebas_backend": "${BACK_RESULT:-n/a}",
  "pruebas_frontend": "${FRONT_RESULT:-n/a}",
  "backend_total": "${BACK_TOTAL:-}",
  "backend_fallidas": "${BACK_FAILED:-}",
  "frontend_total": "${FRONT_TOTAL:-}",
  "frontend_fallidas": "${FRONT_FAILED:-}",
  "fecha": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}]
JSON
)
echo "$CUERPO"
CODIGO=$(curl -s -o /tmp/o2-respuesta.txt -w "%{http_code}" -m 20 -u "${O2_USER}:${O2_PASSWORD}" \
  -H "Content-Type: application/json" -X POST "${O2_URL}/api/default/cicd_pipeline/_json" -d "$CUERPO" || echo "000")
echo "OpenObserve respondió HTTP $CODIGO: $(cat /tmp/o2-respuesta.txt 2>/dev/null)"
exit 0
