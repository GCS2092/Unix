param([int]$cid)
$base = "http://127.0.0.1:8000/api/v1"
$script:fail = 0

function Login($email) {
  (Invoke-RestMethod "$base/auth/login" -Method Post -ContentType "application/json" `
    -Headers @{Accept="application/json"} `
    -Body (@{email=$email; password="password123"} | ConvertTo-Json)).token
}
function Call($token, $method, $path, $body = $null) {
  $p = @{
    Uri = "$base$path"; Method = $method
    Headers = @{Accept="application/json"; Authorization="Bearer $token"}
    SkipHttpErrorCheck = $true; StatusCodeVariable = "sc"
  }
  if ($body) { $p.Body = ($body | ConvertTo-Json); $p.ContentType = "application/json" }
  $res = Invoke-RestMethod @p
  [pscustomobject]@{ Status = $sc; Body = $res }
}
function Check($name, $expected, $actual) {
  if ("$expected" -eq "$actual") { Write-Host "OK   $name ($actual)" -ForegroundColor Green }
  else { Write-Host "FAIL $name : attendu=$expected obtenu=$actual" -ForegroundColor Red; $script:fail++ }
}

$stu  = Login "test@example.com"
$fm   = Login "formation@mail.com"
$shop = Login "boutique@mail.com"
$ins  = Login "formateur@mail.com"
$sup  = Login "admin@example.com"

Write-Host "`n--- Demande d'acces ---"
Check "etudiant : demande" 201 (Call $stu Post "/enrollment-requests" @{course_id=$cid}).Status
Check "etudiant : doublon en attente" 200 (Call $stu Post "/enrollment-requests" @{course_id=$cid}).Status
Check "etudiant : dashboard admin interdit" 403 (Call $stu Get "/admin/formations/dashboard").Status

Write-Host "`n--- Admin formation ---"
$list = Call $fm Get "/admin/enrollment-requests"
Check "formation : liste des demandes" 200 $list.Status
$rid = ($list.Body.data | Where-Object { $_.course_id -eq $cid -and $_.user_email -eq "test@example.com" } | Select-Object -First 1).id
Check "formation : demande trouvee" $true ($null -ne $rid)
Check "formation : recherche etudiants" 200 (Call $fm Get "/admin/formations/users?q=test").Status
Check "formation : acceptation" 200 (Call $fm Post "/admin/enrollment-requests/$rid/decide" @{action="approve"}).Status
Check "formation : deuxieme decision refusee" 422 (Call $fm Post "/admin/enrollment-requests/$rid/decide" @{action="approve"}).Status

Write-Host "`n--- Etudiant apres acceptation ---"
$mine = Call $stu Get "/enrollments"
Check "etudiant : inscrit au cours" 1 @($mine.Body.data | Where-Object { $_.course.id -eq $cid }).Count

Write-Host "`n--- Formateur (instructor) ---"
Check "formateur : cours"            200 (Call $ins Get "/admin/courses").Status
Check "formateur : dashboard"        403 (Call $ins Get "/admin/formations/dashboard").Status
Check "formateur : inscriptions"     403 (Call $ins Get "/admin/enrollments").Status
Check "formateur : demandes d'acces" 403 (Call $ins Get "/admin/enrollment-requests").Status
Check "formateur : utilisateurs"     403 (Call $ins Get "/admin/users").Status

Write-Host "`n--- Admin boutique ---"
Check "boutique : commandes"  200 (Call $shop Get "/admin/orders").Status
Check "boutique : cours"      403 (Call $shop Get "/admin/courses").Status
Check "boutique : enrollments etudiant" 403 (Call $shop Get "/enrollments").Status

Write-Host "`n--- Super admin ---"
Check "super : utilisateurs"  200 (Call $sup Get "/admin/users").Status
Check "super : cours"         200 (Call $sup Get "/admin/courses").Status

Write-Host "`nEchecs : $script:fail" -ForegroundColor $(if ($script:fail) {"Red"} else {"Green"})
