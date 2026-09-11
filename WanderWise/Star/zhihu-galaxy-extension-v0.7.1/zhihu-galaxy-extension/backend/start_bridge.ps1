$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Skill = Join-Path $Here "zhihu-skill"
$Run = Join-Path $Skill "scripts\run.ps1"
$Setup = Join-Path $Skill "scripts\setup.ps1"
$CliHome = if ($env:ZHIHU_CLI_HOME) { $env:ZHIHU_CLI_HOME } else { Join-Path $env:LOCALAPPDATA "ZhihuCLI" }
$DefaultCli = Join-Path $CliHome "current\zhihu-cli.exe"

$status = $null
try { $status = (& powershell -ExecutionPolicy Bypass -File $Run status | ConvertFrom-Json) } catch {}
if (-not (Test-Path $DefaultCli -PathType Leaf) -or ($status -and $status.installed -eq $false)) {
    Write-Host "zhihu-cli 尚未安装或版本不兼容，正在使用随插件附带的官方 Skill 安装器。"
    $setupResult = (& powershell -ExecutionPolicy Bypass -File $Setup | ConvertFrom-Json)
    if (-not $setupResult.ok) { throw "zhihu-cli 安装失败" }
    $env:ZHIHU_CLI = $setupResult.binary_path
} else {
    $env:ZHIHU_CLI = $DefaultCli
}

$authReady = $false
try {
    $null = & $env:ZHIHU_CLI auth status | ConvertFrom-Json
    $authReady = ($LASTEXITCODE -eq 0)
} catch { $authReady = $false }

if (-not $authReady -and -not $env:ZHIHU_ACCESS_SECRET) {
    $secure = Read-Host "首次运行请输入知乎 Access Secret（仅交给官方 CLI，不进入插件源码）" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        $result = $plain | & $env:ZHIHU_CLI auth set --secret-stdin | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw "Access Secret 配置失败" }
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        Remove-Variable plain -ErrorAction SilentlyContinue
    }
}

Write-Host "启动知乎问题星系数据桥接服务：http://127.0.0.1:8765"
Write-Host "关闭此窗口即可停止 bridge。"
python (Join-Path $Here "bridge.py")
