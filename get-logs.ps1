# Получение логов сервера через API
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Получение логов сервера" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$limit = Read-Host "Сколько логов показать? (по умолчанию 200)"
if ([string]::IsNullOrWhiteSpace($limit)) { $limit = 200 }

$filter = Read-Host "Фильтр по тексту (Enter для всех, 'intermediate' для промежуточных изображений)"
if ([string]::IsNullOrWhiteSpace($filter)) { $filter = "" }

$url = "https://newava.pro/api/logs?limit=$limit"
if ($filter) {
    $url += "&filter=$filter"
}

Write-Host "Запрос: $url" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -ContentType "application/json"
    
    Write-Host "Всего логов в буфере: $($response.bufferSize)" -ForegroundColor Green
    Write-Host "Найдено по фильтру: $($response.total)" -ForegroundColor Green
    Write-Host "Показано: $($response.logs.Count)" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ЛОГИ:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($log in $response.logs) {
        Write-Host "[$($log.timestamp)] $($log.message)" -ForegroundColor White
        if ($log.data) {
            $dataJson = $log.data | ConvertTo-Json -Depth 5 -Compress
            Write-Host "  Data: $dataJson" -ForegroundColor Gray
        }
        Write-Host ""
    }
} catch {
    Write-Host "Ошибка при получении логов:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Нажмите любую клавишу для выхода..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

