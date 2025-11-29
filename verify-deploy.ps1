# Проверка статуса деплоя
$ErrorActionPreference = "Continue"

$server = "root@43.245.226.24"
$password = "Yd2Vc_Wejus0DlNB"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Проверка статуса деплоя" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$checkScript = @"
cd /opt/newava

echo "=== ТЕКУЩАЯ ВЕТКА ==="
git branch --show-current 2>/dev/null || echo "Git не инициализирован"

echo ""
echo "=== ПОСЛЕДНИЙ КОММИТ ==="
git log -1 --oneline 2>/dev/null || echo "Коммиты не найдены"

echo ""
echo "=== СТАТУС КОНТЕЙНЕРОВ ==="
if [ -f docker-compose.yml ]; then
    docker compose ps
else
    echo "docker-compose.yml не найден"
fi

echo ""
echo "=== ПРОВЕРКА ДОСТУПНОСТИ ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost || echo "Сервер не отвечает"
"@

# Try plink first
$plink = Get-Command plink -ErrorAction SilentlyContinue
if ($plink) {
    Write-Host "Используется PuTTY plink..." -ForegroundColor Green
    $checkScript | & $plink.Path -ssh $server -pw $password
} else {
    Write-Host "PuTTY не найден. Используется обычный SSH." -ForegroundColor Yellow
    Write-Host "Введите пароль когда попросит: $password" -ForegroundColor Yellow
    Write-Host ""
    $checkScript | ssh $server bash
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Проверка завершена" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Также проверьте сайт: https://newava.pro/" -ForegroundColor Yellow
Write-Host ""

