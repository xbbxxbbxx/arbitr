# Скрипт для загрузки файлов на GitHub через API
# Требует Personal Access Token

$repo = "xbbxxbbxx/arbitr"
$baseUrl = "https://api.github.com/repos/$repo/contents"
$token = Read-Host "Введите ваш GitHub Personal Access Token" -AsSecureString
$tokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

$headers = @{
    "Authorization" = "token $tokenPlain"
    "Accept" = "application/vnd.github.v3+json"
}

# Функция для загрузки файла
function Upload-File {
    param(
        [string]$Path,
        [string]$Content,
        [string]$Message = "Add $Path"
    )
    
    $base64Content = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Content))
    
    $body = @{
        message = $Message
        content = $base64Content
    } | ConvertTo-Json
    
    Write-Host "Uploading $Path..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/$Path" -Method Put -Body $body -Headers $headers -ContentType "application/json"
        Write-Host "✓ $Path uploaded successfully" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "✗ Error uploading $Path : $_" -ForegroundColor Red
        return $null
    }
}

# Загрузка всех файлов
$files = @(
    @{Path="package.json"; Content=(Get-Content "package.json" -Raw)},
    @{Path="server.js"; Content=(Get-Content "server.js" -Raw)},
    @{Path=".gitignore"; Content=(Get-Content ".gitignore" -Raw)},
    @{Path="README.md"; Content=(Get-Content "README.md" -Raw)},
    @{Path="vercel.json"; Content=(Get-Content "vercel.json" -Raw)},
    @{Path="render.yaml"; Content=(Get-Content "render.yaml" -Raw)},
    @{Path="public/index.html"; Content=(Get-Content "public/index.html" -Raw)},
    @{Path="public/app.js"; Content=(Get-Content "public/app.js" -Raw)},
    @{Path="public/styles.css"; Content=(Get-Content "public/styles.css" -Raw)}
)

Write-Host "Начинаю загрузку файлов на GitHub..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
    Upload-File -Path $file.Path -Content $file.Content
}

Write-Host ""
Write-Host "✅ Загрузка завершена!" -ForegroundColor Green
Write-Host "Репозиторий: https://github.com/$repo" -ForegroundColor Cyan

