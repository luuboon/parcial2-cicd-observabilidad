#!/usr/bin/env bash
# Se ejecuta EN la instancia EC2 (lo llama GitHub Actions por SSH).
# Prepara el servidor la primera vez (swap, Docker Compose) y actualiza los contenedores.
set -euo pipefail
REPO_URL="${REPO_URL:?}"; COMMIT="${COMMIT:?}"
DIR="$HOME/parcial2"

# 2 GB de swap: la t3.micro solo tiene 1 GB de RAM
if ! sudo swapon --show | grep -q /swapfile; then
  echo ">> Creando swap de 2 GB"
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Docker y el plugin de Compose
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
if ! sudo docker compose version >/dev/null 2>&1; then
  echo ">> Instalando Docker Compose"
  sudo apt-get update -y && (sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose-plugin) || {
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  }
fi

# Código en la versión exacta del commit que pasó las pruebas
if [ ! -d "$DIR/.git" ]; then git clone "$REPO_URL" "$DIR"; fi
cd "$DIR"
git fetch --depth 50 origin
git reset --hard "$COMMIT"

# .env: los secretos del pipeline + secretos internos que se generan una sola vez en el servidor
touch .env.local && chmod 600 .env.local
grep -q '^POSTGRES_PASSWORD=' .env.local || echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env.local
grep -q '^JWT_SECRET=' .env.local || echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.local
{
  cat .env.local
  echo "O2_USER=${O2_USER}"
  echo "O2_PASSWORD=${O2_PASSWORD}"
  echo "O2_AUTH=$(printf '%s:%s' "$O2_USER" "$O2_PASSWORD" | base64 -w0)"
  echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}"
  echo "APP_VERSION=${COMMIT:0:7}"
} > .env
chmod 600 .env

# El contenedor del proyecto anterior ocupaba el puerto 80
sudo docker rm -f ci-cd-pipeline-api 2>/dev/null || true

echo ">> Construyendo y levantando contenedores"
sudo docker compose up -d --build --remove-orphans
sudo docker image prune -f >/dev/null

echo ">> Esperando a que la app responda"
for i in $(seq 1 40); do
  if curl -fs http://localhost/api/health >/dev/null; then
    curl -s http://localhost/api/health; echo; sudo docker compose ps; exit 0
  fi
  sleep 3
done
echo "La app no respondió a tiempo"; sudo docker compose ps; sudo docker compose logs --tail 50 app; exit 1
