@echo off
:: Проверка и автоматический запрос прав администратора
chcp 65001 > nul
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :admin
) else (
    echo Запрос прав администратора...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:admin
echo [1/4] Отключение интеллектуального управления приложениями...
reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\CI\Policy" /v VerifiedAndReputablePolicyState /t REG_DWORD /d 0 /f

echo [2/4] Принудительное обновление системных политик...
citool.exe -r

echo [3/4] Снятие интернет-блокировки с файла программы...
powershell -Command "Unblock-File -Path 'C:\Users\MS 6\Desktop\авмивамив\SchoolRemoteLock.exe'"

echo [4/4] Добавление папки в исключения антивируса...
powershell -Command "Add-MpPreference -ExclusionPath 'C:\Users\MS 6\Desktop\авмивамив'"

echo [OK] Настройка завершена! Запуск приложения...
start "" "C:\Users\MS 6\Desktop\авмивамив\SchoolRemoteLock.exe"

echo Скрипт успешно выполнен.
timeout /t 3
exit
