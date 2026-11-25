#!/usr/bin/env bash
# Envía a OpenObserve (stream "cicd_pruebas") una fila por cada prueba ejecutada en el pipeline:
# suite (jest/playwright), nombre, archivo, estado y duración, junto con commit, rama y usuario.
# Uso: registrar-pruebas-detalle.sh <jest-resultados.json> <playwright-resultados.json>
set -u
JEST="${1:-}"; PW="${2:-}"
if [ -z "${O2_URL:-}" ] || [ -z "${O2_USER:-}" ] || [ -z "${O2_PASSWORD:-}" ]; then
  echo "OpenObserve no configurado; no se registra el detalle de pruebas"; exit 0
fi
BASE=$(jq -n --arg commit "${GITHUB_SHA:-local}" --arg rama "${GITHUB_REF_NAME:-local}" \
  --arg usuario "${GITHUB_ACTOR:-local}" --arg run_id "${GITHUB_RUN_ID:-0}" \
  '{commit:$commit, commit_corto:($commit[0:7]), rama:$rama, usuario:$usuario, run_id:$run_id}')
FILAS='[]'
if [ -f "$JEST" ]; then
  FILAS=$(jq --argjson base "$BASE" --argjson filas "$FILAS" \
    '$filas + [.testResults[] | (.name | sub(".*/tests/"; "tests/")) as $archivo | .assertionResults[]
      | $base + {suite:"jest", capa:"backend", prueba:.fullName, archivo:$archivo,
                 estado:(if .status=="passed" then "exito" else "fallo" end), duracion_ms:(.duration // 0)}]' "$JEST")
fi
if [ -f "$PW" ]; then
  FILAS=$(jq --argjson base "$BASE" --argjson filas "$FILAS" \
    '$filas + [.. | objects | select(has("specs")) | .specs[] | . as $s | $s.tests[]
      | $base + {suite:"playwright", capa:"frontend", prueba:$s.title, archivo:$s.file,
                 estado:(if $s.ok then "exito" else "fallo" end), duracion_ms:((.results[-1].duration) // 0)}]' "$PW")
fi
TOTAL=$(echo "$FILAS" | jq length)
if [ "$TOTAL" = "0" ]; then echo "No hay resultados de pruebas que registrar"; exit 0; fi
echo "Registrando $TOTAL pruebas ($(echo "$FILAS" | jq '[.[]|select(.estado=="fallo")]|length') fallidas)"
CODIGO=$(echo "$FILAS" | curl -s -o /tmp/o2-detalle.txt -w "%{http_code}" -m 30 -u "${O2_USER}:${O2_PASSWORD}" \
  -H "Content-Type: application/json" -X POST "${O2_URL}/api/default/cicd_pruebas/_json" --data-binary @- || true)
echo "OpenObserve respondió HTTP $CODIGO: $(cat /tmp/o2-detalle.txt 2>/dev/null)"
exit 0
