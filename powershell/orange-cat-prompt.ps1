# >>> orange-cat prompt (ModofClaude) >>>
# A cat in front of the PowerShell prompt that gets scared when the last command failed.
#   🐈 PS C:\project>
#   🙀 meow! (1) PS C:\project>
# Copy this block into your profile (notepad $PROFILE). To remove it, delete from >>> to <<<.
# It only changes how the prompt looks: no network, no files written, nothing run in the background.

# Emoji built from code points so the file reads the same in any encoding
$script:CatOk     = [char]::ConvertFromUtf32(0x1F408)  # cat
$script:CatScare  = [char]::ConvertFromUtf32(0x1F640)  # weary cat face
$script:CatErrors = 0

function prompt {
    $ok = $?  # must be read first: anything else resets it
    if ($ok) {
        Write-Host "$script:CatOk " -NoNewline
    } else {
        $script:CatErrors++
        Write-Host "$script:CatScare " -NoNewline
        Write-Host "meow! ($script:CatErrors) " -ForegroundColor Red -NoNewline
    }
    "PS $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
}
# <<< orange-cat prompt <<<
