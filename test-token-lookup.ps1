# Token Lookup Test Script
Write-Host "=== TOKEN LOOKUP FUNCTIONALITY TEST ===" -ForegroundColor Green
Write-Host ""

# Wait for backend to start
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep 10

# Test 1: Test with sample token
Write-Host "Test 1: Testing token lookup with 'EYABC'" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/users?token=EYABC" -UseBasicParsing
    Write-Host "✅ API Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Content:" -ForegroundColor Yellow
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Test with empty token
Write-Host "Test 2: Testing with empty token (should return error)" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/users?token=" -UseBasicParsing
    Write-Host "✅ API Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Content:" -ForegroundColor Yellow
    $response.Content
} catch {
    Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Test with different token
Write-Host "Test 3: Testing with token 'TEST123'" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/users?token=TEST123" -UseBasicParsing
    Write-Host "✅ API Response Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response Content:" -ForegroundColor Yellow
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ API Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== FRONTEND TEST INSTRUCTIONS ===" -ForegroundColor Green
Write-Host "1. Open browser and go to: http://localhost:3000" -ForegroundColor White
Write-Host "2. Click on 'Token Lookup' in the sidebar (🔍 icon)" -ForegroundColor White
Write-Host "3. Enter a token like 'EYABC' in the input field" -ForegroundColor White
Write-Host "4. Watch the real-time search and results display" -ForegroundColor White
Write-Host ""
Write-Host "Alternative: Go directly to: http://localhost:3000/token-lookup?token=EYABC" -ForegroundColor Cyan

