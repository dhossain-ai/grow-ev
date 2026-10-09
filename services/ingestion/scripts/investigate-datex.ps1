# Read-only coverage diagnostic using the platform XML parser; no raw files saved.
$ErrorActionPreference = 'Stop'

function Get-Publication([string] $name) {
    $response = Invoke-WebRequest -Uri "https://ev.vialietuva.lt/publicdata/$name" -TimeoutSec 60
    $settings = [System.Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($response.Content), $settings)
    try {
        $document = [System.Xml.XmlDocument]::new()
        $document.XmlResolver = $null
        $document.Load($reader)
        return ,$document
    } finally {
        $reader.Dispose()
    }
}

$table = Get-Publication 'EnergyInfrastructureTablePublication'
$status = Get-Publication 'EnergyInfrastructureStatusPublication'
$sites = @($table.SelectNodes('//*[local-name()="energyInfrastructureSite"]'))
$points = @($table.SelectNodes('//*[local-name()="refillPoint"]'))
$providers = @($table.SelectNodes('//*[local-name()="energyProvider"]/*[local-name()="name"]//*[local-name()="value"]') |
    ForEach-Object { $_.InnerText.Trim() } | Sort-Object -Unique)
$siteStatuses = @($status.SelectNodes('//*[local-name()="energyInfrastructureSiteStatus"]'))
$pointStatuses = @($status.SelectNodes('//*[local-name()="refillPointStatus"]'))
$staticIds = @($sites | ForEach-Object { $_.GetAttribute('id') } | Sort-Object -Unique)
$statusIds = @($siteStatuses | ForEach-Object { $_.GetAttribute('id') } | Sort-Object -Unique)
$statusCounts = [ordered]@{}
$status.SelectNodes('//*[local-name()="refillPointStatus"]/*[local-name()="status"]') |
    ForEach-Object InnerText | Group-Object | Sort-Object Name |
    ForEach-Object { $statusCounts[$_.Name] = $_.Count }

[ordered]@{
    observedAt = [DateTimeOffset]::UtcNow.ToString('o')
    table = [ordered]@{
        publicationTime = $table.SelectSingleNode('//*[local-name()="publicationTime"]').InnerText
        sites = $sites.Count
        uniqueSiteIds = $staticIds.Count
        stations = $table.SelectNodes('//*[local-name()="energyInfrastructureStation"]').Count
        refillPoints = $points.Count
        uniqueRefillPointIds = @($points | ForEach-Object { $_.GetAttribute('id') } | Sort-Object -Unique).Count
        connectors = $table.SelectNodes('//*[local-name()="connector"]').Count
        providerNameCount = $providers.Count
        providerNames = $providers
        stableOperatorIdentifiers = 'Not published on energyProvider objects; names are not stable IDs.'
    }
    status = [ordered]@{
        publicationTime = $status.SelectSingleNode('//*[local-name()="publicationTime"]').InnerText
        sites = $siteStatuses.Count
        uniqueSiteIds = $statusIds.Count
        refillPointStatuses = $pointStatuses.Count
        statuses = $statusCounts
        sitesWithoutStaticRecord = @($statusIds | Where-Object { $_ -notin $staticIds }).Count
        staticSitesWithoutStatus = @($staticIds | Where-Object { $_ -notin $statusIds }).Count
    }
} | ConvertTo-Json -Depth 6
