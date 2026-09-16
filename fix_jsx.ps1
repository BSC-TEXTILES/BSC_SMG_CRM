$content = Get-Content 'D:\BTPL_SMG\BSC_SMG\frontend\src\pages\VmChecklist.tsx' -Raw
$content = $content -replace 'Failed \(<80%\)', 'Failed (<80%)'
[System.IO.File]::WriteAllText('D:\BTPL_SMG\BSC_SMG\frontend\src\pages\VmChecklist.tsx', $content)