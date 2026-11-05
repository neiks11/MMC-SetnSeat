@echo off
title MMC Set n Seat Rentals - Push to GitHub
cd /d "C:\Users\Lenovo\.gemini\antigravity\scratch\mmc-set-n-seat-rentals"
echo ========================================================
echo   Pushing MMC Set n Seat Rentals to GitHub (main)...
echo   Repository: https://github.com/neiks11/MMC-SetnSeat.git
echo ========================================================
echo.
git push -u origin main
echo.
echo ========================================================
echo   If push succeeded, go to:
echo   https://github.com/neiks11/MMC-SetnSeat/settings/pages
echo   and set Source to "GitHub Actions"!
echo ========================================================
pause

