function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Planner')
    .addItem('Sync sections (ctcLink)', 'SyncSections')
    .addItem('Sync RateMyProfessors', 'SyncRmp')
    .addItem('Recompute rankings', 'RecomputeRankings')
    .addSeparator()
    .addItem('Clear API cache', 'ClearFmcCache')
    .addToUi();
}

function ClearFmcCache() {
  CacheService.getScriptCache().removeAll([
    // CacheService has no list; document that keys expire naturally.
  ]);
  SpreadsheetApp.getUi().alert(
    'Script cache entries expire automatically (~10 minutes). Redeploy or wait for TTL.'
  );
}
