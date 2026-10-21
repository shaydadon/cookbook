# Registers the Facebook helper in Task Scheduler: every 15 minutes while this user is logged on, no console window.
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$deno = Join-Path $repo "node_modules\deno\deno.exe"
if (-not (Test-Path $deno)) { $deno = (Get-Command deno -ErrorAction Stop).Source }
$main = Join-Path $repo "tools\fb-helper\main.ts"

# conhost --headless runs the console program without opening a window.
$action = New-ScheduledTaskAction -Execute "conhost.exe" `
  -Argument "--headless `"$deno`" run --node-modules-dir=auto -A `"$main`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 15)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 14) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "CookbookFacebookHelper" -Action $action -Trigger $trigger -Settings $settings -Force |
  Out-Null
Write-Output "Registered CookbookFacebookHelper (every 15 minutes)."
