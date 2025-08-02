# 测试中文文件名处理脚本
# 用于验证修复后的编码设置是否正确

# 设置控制台编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   中文文件名编码测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 创建测试目录
$testDir = "test-chinese-files"
if (!(Test-Path $testDir)) {
    New-Item -ItemType Directory -Path $testDir
    Write-Host "[创建] 测试目录: $testDir" -ForegroundColor Green
}

# 创建包含中文名称的测试文件
$chineseFiles = @(
    "测试文件1.txt",
    "重复文件检测.log",
    "音乐文件-周杰伦.mp3",
    "图片-风景照片.jpg",
    "文档-项目说明书.pdf"
)

foreach ($fileName in $chineseFiles) {
    $filePath = Join-Path $testDir $fileName
    if (!(Test-Path $filePath)) {
        "这是一个测试文件: $fileName" | Out-File -FilePath $filePath -Encoding UTF8
        Write-Host "[创建] 测试文件: $fileName" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "测试文件创建完成！" -ForegroundColor Yellow
Write-Host "请在应用中扫描 '$testDir' 目录来测试中文文件名显示" -ForegroundColor Yellow
Write-Host ""

# 列出创建的文件
Write-Host "创建的测试文件列表:" -ForegroundColor Cyan
Get-ChildItem $testDir | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor White
}

Write-Host ""
Write-Host "按任意键继续..." -ForegroundColor Green
Read-Host