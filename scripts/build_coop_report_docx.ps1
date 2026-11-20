# scripts/build_coop_report_docx.ps1
# Script to compile all markdown chapters into an academic cooperative education report DOCX
# for Huachiew Chalermprakiet University (AI4916)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue

$workspaceDir = "c:\Users\Administrator\Documents\GitHub\HSK1"
$docsDir = Join-Path $workspaceDir "docs"
$imagesDir = Join-Path $docsDir "images"
$htmlOutputPath = Join-Path $docsDir "coop_report_compiled.html"
$docxOutputPath = Join-Path $docsDir "รายงานสหกิจศึกษา_AI4916_ฉบับสมบูรณ์.docx"

Write-Host ">>> Starting compilation of AI4916 Cooperative Education Report..." -ForegroundColor Cyan

$files = @(
    (Join-Path $docsDir "front_matter.md"),
    (Join-Path $docsDir "chapter1_organization.md"),
    (Join-Path $docsDir "chapter2_project_overview.md"),
    (Join-Path $docsDir "chapter3_theories_and_research.md"),
    (Join-Path $docsDir "chapter4_system_analysis_and_design.md"),
    (Join-Path $docsDir "chapter5_results_and_conclusion.md"),
    (Join-Path $docsDir "references_and_appendices.md")
)

# HTML Header and Academic Styling matching HCU guidelines
$html = @"
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>รายงานการปฏิบัติงานสหกิจศึกษา AI4916</title>
<style>
  @page {
    size: A4;
    margin-top: 3.81cm;     /* 1.5 in */
    margin-bottom: 2.54cm;  /* 1.0 in */
    margin-left: 3.81cm;    /* 1.5 in */
    margin-right: 2.54cm;   /* 1.0 in */
  }
  body {
    font-family: 'TH SarabunPSK', 'TH Sarabun New', 'Angsana New', sans-serif;
    font-size: 16pt;
    line-height: 1.15;
    color: #000000;
  }
  .page-break {
    page-break-before: always;
    clear: both;
  }
  .cover-page {
    text-align: center;
    page-break-after: always;
    padding-top: 2cm;
    padding-bottom: 2cm;
  }
  .cover-title {
    font-size: 18pt;
    font-weight: bold;
    margin-bottom: 2cm;
    line-height: 1.3;
  }
  .cover-author {
    font-size: 16pt;
    font-weight: bold;
    margin-top: 3cm;
    margin-bottom: 3cm;
    line-height: 1.4;
  }
  .cover-footer {
    font-size: 16pt;
    font-weight: bold;
    line-height: 1.3;
  }
  h1.chapter-title {
    font-size: 18pt;
    font-weight: bold;
    text-align: center;
    margin-top: 1.5cm;
    margin-bottom: 0.8cm;
    page-break-before: always;
  }
  h2.section-title {
    font-size: 16pt;
    font-weight: bold;
    text-align: left;
    margin-top: 0.6cm;
    margin-bottom: 0.3cm;
  }
  h3.subsection-title {
    font-size: 16pt;
    font-weight: bold;
    text-align: left;
    margin-top: 0.4cm;
    margin-bottom: 0.2cm;
    text-indent: 0.5cm;
  }
  h4.subsubsection-title {
    font-size: 16pt;
    font-weight: bold;
    text-align: left;
    margin-top: 0.3cm;
    margin-bottom: 0.2cm;
    text-indent: 1.0cm;
  }
  p {
    font-size: 16pt;
    line-height: 1.15;
    text-align: justify;
    text-justify: inter-cluster;
    text-indent: 1.25cm;
    margin-top: 0;
    margin-bottom: 6pt;
  }
  p.no-indent {
    text-indent: 0 !important;
  }
  p.caption {
    font-size: 15pt;
    font-weight: bold;
    text-align: center;
    text-indent: 0;
    margin-top: 6pt;
    margin-bottom: 12pt;
  }
  .figure-box {
    text-align: center;
    margin-top: 12pt;
    margin-bottom: 12pt;
  }
  .figure-box img {
    max-width: 85%;
    height: auto;
    border: 1px solid #ddd;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 10pt;
    margin-bottom: 14pt;
    font-size: 15pt;
  }
  th, td {
    border: 1px solid #000000;
    padding: 4pt 6pt;
    vertical-align: top;
  }
  th {
    background-color: #f2f2f2;
    font-weight: bold;
    text-align: center;
  }
  td.center {
    text-align: center;
  }
  pre {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 13pt;
    background-color: #f8f9fa;
    border: 1px solid #cccccc;
    padding: 8pt;
    white-space: pre-wrap;
    word-break: break-all;
    margin-top: 6pt;
    margin-bottom: 12pt;
  }
  ul, ol {
    margin-top: 0;
    margin-bottom: 6pt;
    padding-left: 2cm;
  }
  li {
    font-size: 16pt;
    line-height: 1.15;
    margin-bottom: 3pt;
  }
  blockquote {
    border-left: 3px solid #2b6cb0;
    margin: 8pt 0 8pt 1.25cm;
    padding-left: 10pt;
    font-style: italic;
    color: #2d3748;
  }
  code {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 14pt;
    background-color: #edf2f7;
    padding: 1pt 3pt;
    border-radius: 2pt;
  }
</style>
</head>
<body>
"@

function Convert-MarkdownToHtmlBody([string]$mdText) {
    $lines = $mdText -split "`r?`n"
    $sb = New-Object System.Text.StringBuilder
    $inTable = $false
    $tableRows = @()
    $inCode = $false
    $codeLang = ""
    $codeLines = @()
    $inList = $false
    $listType = ""

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        $trimmed = $line.Trim()

        # Fenced code block toggle
        if ($trimmed -match '^```(.*)$') {
            if (-not $inCode) {
                # Close list if open
                if ($inList) {
                    [void]$sb.AppendLine("</$listType>")
                    $inList = $false
                }
                $inCode = $true
                $codeLang = $matches[1]
                $codeLines = @()
            } else {
                $inCode = $false
                $codeContent = [System.Net.WebUtility]::HtmlEncode(($codeLines -join "`n"))
                [void]$sb.AppendLine("<pre><code>$codeContent</code></pre>")
            }
            continue
        }

        if ($inCode) {
            $codeLines += $line
            continue
        }

        # Table rows
        if ($trimmed -match '^\|(.+)\|$') {
            if (-not $inTable) {
                if ($inList) {
                    [void]$sb.AppendLine("</$listType>")
                    $inList = $false
                }
                $inTable = $true
                $tableRows = @()
            }
            # Check if separator row like | :--- | :---: |
            if ($trimmed -match '^\|[\s\:\-\|]+$') {
                continue
            }
            $tableRows += $trimmed
            continue
        } else {
            if ($inTable) {
                $inTable = $false
                # Render table
                [void]$sb.AppendLine("<table>")
                for ($r = 0; $r -lt $tableRows.Count; $r++) {
                    $row = $tableRows[$r]
                    $cells = $row.Trim('|').Split('|')
                    $tag = if ($r -eq 0) { "th" } else { "td" }
                    [void]$sb.Append("  <tr>")
                    foreach ($c in $cells) {
                        $cTrimmed = $c.Trim()
                        # Simple inline formatting
                        $cTrimmed = $cTrimmed -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
                        $cTrimmed = $cTrimmed -replace '\*(.+?)\*', '<em>$1</em>'
                        $cTrimmed = $cTrimmed -replace '`(.+?)`', '<code>$1</code>'
                        $alignClass = ""
                        if ($cTrimmed -match '^[0-9\.\-\+\%\s]+$' -or $cTrimmed -eq "■" -or $cTrimmed -eq "ผ่าน") {
                            $alignClass = ' class="center"'
                        }
                        [void]$sb.Append("<$tag$alignClass>$cTrimmed</$tag>")
                    }
                    [void]$sb.AppendLine("</tr>")
                }
                [void]$sb.AppendLine("</table>")
            }
        }

        # Blank line
        if ($trimmed -eq "") {
            if ($inList) {
                [void]$sb.AppendLine("</$listType>")
                $inList = $false
            }
            continue
        }

        # Horizontal rule / page break
        if ($trimmed -match '^---+$') {
            if ($inList) {
                [void]$sb.AppendLine("</$listType>")
                $inList = $false
            }
            [void]$sb.AppendLine('<div class="page-break"></div>')
            continue
        }

        # Headings
        if ($trimmed -match '^#\s+(.+)$') {
            $hText = $matches[1]
            [void]$sb.AppendLine("<h1 class=`"chapter-title`">$hText</h1>")
            continue
        }
        if ($trimmed -match '^##\s+(.+)$') {
            $hText = $matches[1]
            [void]$sb.AppendLine("<h2 class=`"section-title`">$hText</h2>")
            continue
        }
        if ($trimmed -match '^###\s+(.+)$') {
            $hText = $matches[1]
            [void]$sb.AppendLine("<h3 class=`"subsection-title`">$hText</h3>")
            continue
        }
        if ($trimmed -match '^####\s+(.+)$') {
            $hText = $matches[1]
            [void]$sb.AppendLine("<h4 class=`"subsubsection-title`">$hText</h4>")
            continue
        }

        # Images: ![alt](images/filename.png)
        if ($trimmed -match '!\[(.*?)\]\((.*?)\)') {
            $alt = $matches[1]
            $imgRel = $matches[2]
            $imgAbs = Join-Path $docsDir $imgRel
            if (Test-Path $imgAbs) {
                $imgUri = (New-Object System.Uri($imgAbs)).AbsoluteUri
                [void]$sb.AppendLine("<div class=`"figure-box`"><img src=`"$imgUri`" alt=`"$alt`" /></div>")
            } else {
                [void]$sb.AppendLine("<div class=`"figure-box`"><p><strong>[รูปภาพ: $alt]</strong></p></div>")
            }
            continue
        }

        # Captions like **รูปที่ 1.1** ... or **ตารางที่ 1.1** ...
        if ($trimmed -match '^\*\*(รูปที่|ตารางที่)\s+[0-9\.]+\*\*\s+(.+)$') {
            $pFormatted = $trimmed -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
            [void]$sb.AppendLine("<p class=`"caption`">$pFormatted</p>")
            continue
        }

        # Lists: Unordered
        if ($trimmed -match '^[\*\-]\s+(.+)$') {
            if (-not $inList -or $listType -ne "ul") {
                if ($inList) { [void]$sb.AppendLine("</$listType>") }
                [void]$sb.AppendLine("<ul>")
                $inList = $true
                $listType = "ul"
            }
            $item = $matches[1]
            $item = $item -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
            $item = $item -replace '\*(.+?)\*', '<em>$1</em>'
            $item = $item -replace '`(.+?)`', '<code>$1</code>'
            [void]$sb.AppendLine("  <li>$item</li>")
            continue
        }

        # Lists: Ordered
        if ($trimmed -match '^[0-9]+\.\s+(.+)$') {
            if (-not $inList -or $listType -ne "ol") {
                if ($inList) { [void]$sb.AppendLine("</$listType>") }
                [void]$sb.AppendLine("<ol>")
                $inList = $true
                $listType = "ol"
            }
            $item = $matches[1]
            $item = $item -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
            $item = $item -replace '\*(.+?)\*', '<em>$1</em>'
            $item = $item -replace '`(.+?)`', '<code>$1</code>'
            [void]$sb.AppendLine("  <li>$item</li>")
            continue
        }

        # Blockquote
        if ($trimmed -match '^>\s*(.*)$') {
            $bText = $matches[1]
            $bText = $bText -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
            $bText = $bText -replace '\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]', '<strong>$1:</strong>'
            [void]$sb.AppendLine("<blockquote>$bText</blockquote>")
            continue
        }

        # Normal Paragraph
        if ($inList) {
            [void]$sb.AppendLine("</$listType>")
            $inList = $false
        }
        $pText = $trimmed -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
        $pText = $pText -replace '\*(.+?)\*', '<em>$1</em>'
        $pText = $pText -replace '`(.+?)`', '<code>$1</code>'
        [void]$sb.AppendLine("<p>$pText</p>")
    }

    if ($inList) {
        [void]$sb.AppendLine("</$listType>")
    }
    if ($inTable) {
        [void]$sb.AppendLine("</table>")
    }

    return $sb.ToString()
}

# Compile each file into HTML
foreach ($file in $files) {
    Write-Host "Reading $file..." -ForegroundColor Yellow
    $content = Get-Content -Path $file -Raw -Encoding utf8
    $converted = Convert-MarkdownToHtmlBody $content
    $html += "`n" + $converted
}

$html += @"
</body>
</html>
"@

# Save HTML
Add-Type -AssemblyName System.Web
[System.IO.File]::WriteAllText($htmlOutputPath, $html, [System.Text.Encoding]::UTF8)
Write-Host ">>> HTML compiled successfully at: $htmlOutputPath" -ForegroundColor Green

# Use Word COM Object to convert HTML to native DOCX
Write-Host ">>> Launching Microsoft Word COM Automation to build DOCX..." -ForegroundColor Cyan

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($htmlOutputPath, $false, $false, $false)
    
    # Configure document settings
    $doc.PageSetup.PaperSize = 7 # wdPaperA4
    $doc.PageSetup.TopMargin = 108     # 1.5 inch in points (72 * 1.5)
    $doc.PageSetup.BottomMargin = 72   # 1.0 inch
    $doc.PageSetup.LeftMargin = 108    # 1.5 inch
    $doc.PageSetup.RightMargin = 72    # 1.0 inch
    
    # Save as DOCX (wdFormatXMLDocument = 16)
    $doc.SaveAs2($docxOutputPath, 16)
    $doc.Close()
    Write-Host ">>> SUCCESS: Native Word Report generated at: $docxOutputPath" -ForegroundColor Green
}
catch {
    Write-Error "Failed to convert via Word COM: $_"
}
finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
