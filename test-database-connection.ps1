# Database Connection Test Script
Write-Host "=== DATABASE CONNECTION TEST ===" -ForegroundColor Green
Write-Host ""

# Test 1: Check if backend is running
Write-Host "Test 1: Checking if backend is running..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/branches" -UseBasicParsing
    Write-Host "✅ Backend is running - Status: $($response.StatusCode)" -ForegroundColor Green
    $branchCount = ($response.Content | ConvertFrom-Json).Count
    Write-Host "✅ RPCMaster connection working - Found $branchCount branches" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please start the backend first with: dotnet run" -ForegroundColor Yellow
    exit
}

Write-Host ""

# Test 2: Test RpcWebsite database connection
Write-Host "Test 2: Testing RpcWebsite database connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/users?token=EYABC" -UseBasicParsing
    Write-Host "✅ RpcWebsite connection working - Status: $($response.StatusCode)" -ForegroundColor Green
    $users = $response.Content | ConvertFrom-Json
    Write-Host "✅ Found $($users.Count) users with token 'EYABC'" -ForegroundColor Green
    if ($users.Count -gt 0) {
        Write-Host "First user details:" -ForegroundColor Yellow
        $users[0] | ConvertTo-Json -Depth 2
    }
} catch {
    Write-Host "❌ RpcWebsite connection failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""

# Test 3: Test with different tokens
Write-Host "Test 3: Testing with different tokens..." -ForegroundColor Cyan
$testTokens = @("TEST123", "ADMIN", "USER", "")
foreach ($token in $testTokens) {
    try {
        if ($token -eq "") {
            Write-Host "Testing with empty token..." -ForegroundColor Yellow
            $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/users?token=" -UseBasicParsing
        } else {
            Write-Host "Testing with token: $token" -ForegroundColor Yellow
            $response = Invoke-WebRequest -Uri "http://localhost:5000/api/rpc/users?token=$token" -UseBasicParsing
        }
        
        if ($response.StatusCode -eq 200) {
            $users = $response.Content | ConvertFrom-Json
            Write-Host "✅ Token '$token': Found $($users.Count) users" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Token '$token': Status $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Token '$token': Error - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Green
Write-Host "RPCMaster Database: ✅ WORKING (branches endpoint)" -ForegroundColor Green
Write-Host "RpcWebsite Database: Check results above" -ForegroundColor Yellow
Write-Host ""
Write-Host "If RpcWebsite is not working, possible issues:" -ForegroundColor Yellow
Write-Host "1. Database 'RpcWebsite' doesn't exist" -ForegroundColor White
Write-Host "2. Table 'dbo.Users' doesn't exist" -ForegroundColor White
Write-Host "3. User 'sarpc' doesn't have access to RpcWebsite database" -ForegroundColor White
Write-Host "4. Table structure is different than expected" -ForegroundColor White
Write-Host "5. Column names don't match (Username, BU, LoginType, etc.)" -ForegroundColor White

