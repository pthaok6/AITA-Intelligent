$base = "http://localhost:5000/api"

Write-Host "--- 1. Health check ---"
$health = Invoke-RestMethod -Uri "$base/health"
Write-Host "Health:" ($health | ConvertTo-Json -Compress)

Write-Host "--- 2. Register Lecturer ---"
$bodyLec = @{
    email = "thay.nguyen@fpt.edu.vn"
    password = "password123"
    fullName = "Thầy Nguyễn Văn A"
    role = "LECTURER"
} | ConvertTo-Json
$lecRes = Invoke-RestMethod -Uri "$base/auth/register" -Method Post -Body $bodyLec -ContentType "application/json"
$lecToken = $lecRes.data.token
Write-Host "Lecturer Registered. Token: $($lecToken.Substring(0, 20))..."

Write-Host "--- 3. Create Class ---"
$bodyClass = @{
    classCode = "SE1801-SWP391"
    name = "Kỹ nghệ phần mềm - SE1801"
    semester = "SU26"
} | ConvertTo-Json
$classRes = Invoke-RestMethod -Uri "$base/classes" -Method Post -Body $bodyClass -ContentType "application/json" -Headers @{ Authorization = "Bearer $lecToken" }
$classId = $classRes.data.id
Write-Host "Class Created. ClassId: $classId"

Write-Host "--- 4. Create Exam with 2 TestCases ---"
$startTime = (Get-Date).AddMinutes(-5).ToString("o")
$endTime = (Get-Date).AddHours(2).ToString("o")
$bodyExam = @{
    classId = $classId
    title = "Bài tập 1: Tính tổng 2 số nguyên A + B"
    descriptionMd = "Cho 2 số nguyên a và b trên cùng 1 dòng, in ra a + b."
    allowedLanguage = "PYTHON"
    startTime = $startTime
    endTime = $endTime
    testCases = @(
        @{ inputData = "3 5"; expectedOutput = "8"; isHidden = $false; scoreWeight = 5.0; orderIndex = 1 },
        @{ inputData = "10 20"; expectedOutput = "30"; isHidden = $true; scoreWeight = 5.0; orderIndex = 2 }
    )
} | ConvertTo-Json -Depth 5
$examRes = Invoke-RestMethod -Uri "$base/exams" -Method Post -Body $bodyExam -ContentType "application/json" -Headers @{ Authorization = "Bearer $lecToken" }
$examId = $examRes.data.id
Write-Host "Exam Created. ExamId: $examId"

Write-Host "--- 5. Register Student ---"
$bodyStu = @{
    email = "sinhvien.b@fpt.edu.vn"
    password = "password123"
    fullName = "Sinh viên B"
    role = "STUDENT"
} | ConvertTo-Json
$stuRes = Invoke-RestMethod -Uri "$base/auth/register" -Method Post -Body $bodyStu -ContentType "application/json"
$stuToken = $stuRes.data.token
Write-Host "Student Registered. Token: $($stuToken.Substring(0, 20))..."

Write-Host "--- 6. Student Enrolls Class ---"
Invoke-RestMethod -Uri "$base/classes/$classId/enroll" -Method Post -Headers @{ Authorization = "Bearer $stuToken" } | Out-Null
Write-Host "Student Enrolled successfully."

Write-Host "--- 7. Student Submits Code ---"
$code = "a, b = map(int, input().split())`nprint(a + b)"
$bodySub = @{ sourceCode = $code } | ConvertTo-Json
$subRes = Invoke-RestMethod -Uri "$base/exams/$examId/submissions" -Method Post -Body $bodySub -ContentType "application/json" -Headers @{ Authorization = "Bearer $stuToken" }
$subId = $subRes.data.id
Write-Host "Code Submitted. SubmissionId: $subId | Initial Status: $($subRes.data.status)"

Write-Host "--- 8. Waiting for Worker to Process from Queue ---"
Start-Sleep -Seconds 2

Write-Host "--- 9. Student checks Submission Result ---"
$finalSub = Invoke-RestMethod -Uri "$base/submissions/$subId" -Headers @{ Authorization = "Bearer $stuToken" }
Write-Host "Final Status: $($finalSub.data.status)"
Write-Host "Total Score: $($finalSub.data.totalScore)"
Write-Host "Test Results Count: $($finalSub.data.testResults.Count)"
foreach ($tr in $finalSub.data.testResults) {
    Write-Host "  -> TestCase #$($tr.testCase.orderIndex): Status=$($tr.status), Score=$($tr.scoreEarned), Time=$($tr.executionTimeMs)ms"
}
