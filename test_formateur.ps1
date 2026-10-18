$base = "http://127.0.0.1:8000/api/v1"
$script:fail = 0
$info = php artisan tinker --execute='$a=App\Models\User::where("email","formateur@mail.com")->value("id"); $c=App\Models\Course::orderBy("id")->take(2)->get(); echo json_encode(["a"=>$a,"idA"=>$c[0]->id,"slugA"=>$c[0]->slug,"idB"=>$c[1]->id,"slugB"=>$c[1]->slug]);' | ConvertFrom-Json

function Login($email) {
  (Invoke-RestMethod "$base/auth/login" -Method Post -ContentType "application/json" -Headers @{Accept="application/json"} `
    -Body (@{email=$email; password="password123"} | ConvertTo-Json)).token
}
function Call($token, $method, $path, $body = $null) {
  $p = @{ Uri="$base$path"; Method=$method; Headers=@{Accept="application/json"; Authorization="Bearer $token"}
          SkipHttpErrorCheck=$true; StatusCodeVariable="sc" }
  if ($body) { $p.Body = ($body | ConvertTo-Json); $p.ContentType = "application/json" }
  $res = Invoke-RestMethod @p
  [pscustomobject]@{ Status=$sc; Body=$res }
}
function Check($name, $expected, $actual) {
  if ("$expected" -eq "$actual") { Write-Host "OK   $name ($actual)" -ForegroundColor Green }
  else { Write-Host "FAIL $name : attendu=$expected obtenu=$actual" -ForegroundColor Red; $script:fail++ }
}

$ins = Login "formateur@mail.com"
$fm  = Login "formation@mail.com"
$when = (Get-Date).ToUniversalTime().AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")

Write-Host "`n--- Formateur A : ses cours ---"
$l = Call $ins Get "/admin/courses"
$ids = @($l.Body.data | ForEach-Object { $_.id })
Check "liste : contient son cours" $true ($ids -contains $info.idA)
Check "liste : sans le cours d'un autre" $false ($ids -contains $info.idB)
Check "show son cours"            200 (Call $ins Get "/admin/courses/$($info.slugA)").Status
Check "meeting son cours"         200 (Call $ins Get "/admin/courses/$($info.idA)/meeting").Status
Check "join-requests son cours"   200 (Call $ins Get "/admin/courses/$($info.idA)/join-requests").Status

Write-Host "`n--- Formateur A : cours d'un autre ---"
Check "show"                 403 (Call $ins Get "/admin/courses/$($info.slugB)").Status
Check "update"               403 (Call $ins Patch "/admin/courses/$($info.slugB)" @{title="hack"}).Status
Check "delete"               403 (Call $ins Delete "/admin/courses/$($info.slugB)").Status
Check "live start"           403 (Call $ins Post "/admin/courses/$($info.idB)/live/start").Status
Check "meeting"              403 (Call $ins Get "/admin/courses/$($info.idB)/meeting").Status
Check "join-requests"        403 (Call $ins Get "/admin/courses/$($info.idB)/join-requests").Status
Check "planifier une seance" 403 (Call $ins Post "/admin/live-sessions" @{course_id=$info.idB; starts_at=$when}).Status

Write-Host "`n--- Creation par un formateur ---"
$new = Call $ins Post "/admin/courses" @{title="Test instructor"; price=0}
Check "creation" 201 $new.Status
$owner = php artisan tinker --execute='echo App\Models\Course::where("title","Test instructor")->value("instructor_id");'
Check "proprietaire = formateur A" $info.a ([int]$owner)
Check "suppression de son cours" 204 (Call $ins Delete "/admin/courses/$($new.Body.data.slug)").Status

Write-Host "`n--- Admin formation : tout voir ---"
$fl = Call $fm Get "/admin/courses"
$fids = @($fl.Body.data | ForEach-Object { $_.id })
Check "formation voit A" $true ($fids -contains $info.idA)
Check "formation voit B" $true ($fids -contains $info.idB)
Check "formation : meeting de B" 200 (Call $fm Get "/admin/courses/$($info.idB)/meeting").Status

Write-Host "`nEchecs : $script:fail" -ForegroundColor $(if ($script:fail) {"Red"} else {"Green"})
