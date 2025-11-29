# Проверка версии/ветки на проде через альтернативные методы
$ErrorActionPreference = "Continue"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Проверка ветки на проде" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Локальная информация
Write-Host "=== ЛОКАЛЬНАЯ ИНФОРМАЦИЯ ===" -ForegroundColor Yellow
$localBranch = git branch --show-current
$localCommit = git log -1 --oneline
Write-Host "Ветка: $localBranch" -ForegroundColor Green
Write-Host "Коммит: $localCommit" -ForegroundColor Green
Write-Host ""

# Проверка через веб
Write-Host "=== ПРОВЕРКА ЧЕРЕЗ ВЕБ ===" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://newava.pro/" -UseBasicParsing -TimeoutSec 10
    Write-Host "HTTP Status: $($response.StatusCode)" -ForegroundColor Green
    
    # Ищем признаки версии в HTML
    $content = $response.Content
    if ($content -match "avatar|commit|version|16dd6e1") {
        Write-Host "Найдены признаки версии в контенте" -ForegroundColor Green
    }
    
    # Проверяем заголовки
    Write-Host "Server: $($response.Headers.Server)" -ForegroundColor Cyan
    Write-Host "Content-Type: $($response.Headers.'Content-Type')" -ForegroundColor Cyan
} catch {
    Write-Host "Ошибка при проверке веб-сайта: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Попытка через SSH ключ
Write-Host "=== ПРОВЕРКА ЧЕРЕЗ SSH ===" -ForegroundColor Yellow
$sshKey = "$env:USERPROFILE\.ssh\avatar_deploy"
if (Test-Path $sshKey) {
    Write-Host "Найден SSH ключ: $sshKey" -ForegroundColor Green
    Write-Host "Попытка подключения через ключ..." -ForegroundColor Yellow
    
    $checkScript = @"
cd /opt/newava 2>/dev/null || cd /root/newava 2>/dev/null || echo "Директория не найдена"
if [ -d .git ]; then
    echo "Ветка: $(git branch --show-current)"
    echo "Коммит: $(git log -1 --oneline)"
    echo "Хеш: $(git rev-parse HEAD)"
else
    echo "Git не инициализирован"
fi
"@
    
    try {
        $result = ssh -i $sshKey -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@43.245.226.24 $checkScript 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host $result -ForegroundColor Green
        } else {
            Write-Host "SSH ключ не работает или требуется пароль" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Ошибка SSH: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "SSH ключ не найден" -ForegroundColor Yellow
}
Write-Host ""

# Проверка через GitHub Actions
Write-Host "=== ПРОВЕРКА GITHUB ACTIONS ===" -ForegroundColor Yellow
Write-Host "Проверьте статус деплоя: https://github.com/luckyit-test/AI-Avatar/actions" -ForegroundColor Cyan
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "РЕКОМЕНДАЦИЯ" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для точной проверки ветки на проде:" -ForegroundColor Yellow
Write-Host "1. Установите PuTTY и используйте deploy-putty.bat" -ForegroundColor White
Write-Host "2. Или обратитесь к администратору сервера" -ForegroundColor White
Write-Host "3. Или настройте GitHub Actions для автоматического деплоя" -ForegroundColor White
Write-Host ""

