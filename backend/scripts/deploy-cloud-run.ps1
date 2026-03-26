# SalonFlow — собрать backend, отправить в Artifact Registry, задеплоить Cloud Run
# Запуск из PowerShell: правый клик → Run with PowerShell, или:
#   cd C:\Users\XE\Desktop\salonflow\backend\scripts
#   .\deploy-cloud-run.ps1
#
# Нужно: установлены Docker Desktop, Google Cloud SDK (gcloud), ты залогинен в нужный Google-аккаунт.

$ErrorActionPreference = "Stop"

# ── твой проект (как в Cloud Console) ─────────────────────────────
$PROJECT_ID   = "salonflow-prod"
$REGION       = "europe-west1"
$SERVICE_NAME = "salonflow-api"
$REPO         = "salonflow"           # имя репозитория в Artifact Registry
$IMAGE_NAME   = "backend"
$TAG          = "latest"

$REGISTRY_HOST = "$REGION-docker.pkg.dev"
$IMAGE_URI     = "$REGISTRY_HOST/$PROJECT_ID/$REPO/${IMAGE_NAME}:$TAG"

# Корень backend (где Dockerfile) — папка scripts на уровень выше
$BackendRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $BackendRoot "Dockerfile"))) {
    Write-Host "Не найден Dockerfile. Ожидается: $BackendRoot\Dockerfile" -ForegroundColor Red
    exit 1
}

Write-Host "==> Проект: $PROJECT_ID | образ: $IMAGE_URI" -ForegroundColor Cyan

# 1) Активировать проект и авторизация Docker для Artifact Registry
gcloud config set project $PROJECT_ID
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# 2) Сборка (из папки backend, где лежит Dockerfile)
Set-Location $BackendRoot
Write-Host "==> docker build..." -ForegroundColor Cyan
docker build -t $IMAGE_URI .

# 3) Push
Write-Host "==> docker push..." -ForegroundColor Cyan
docker push $IMAGE_URI

# 4) Деплой Cloud Run (подставляет новый образ; сервис уже должен существовать)
Write-Host "==> gcloud run deploy $SERVICE_NAME ..." -ForegroundColor Cyan
gcloud run deploy $SERVICE_NAME `
    --image $IMAGE_URI `
    --region $REGION `
    --project $PROJECT_ID

Write-Host ""
Write-Host "Done. Check Cloud Run revision; bot /start to reload." -ForegroundColor Green
