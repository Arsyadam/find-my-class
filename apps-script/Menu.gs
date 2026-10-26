function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Planner')
    .addItem('Clear API cache', 'ClearFmcCache')
    .addSeparator()
    .addItem('Sync sections (stub)', 'SyncSections')
    .addItem('Sync RateMyProfessors (stub)', 'SyncRmp')
    .addItem('Recompute rankings (stub)', 'RecomputeRankings')
    .addToUi();
}

function ClearFmcCache() {
  // CacheService has no enumerate API; entries expire via TTL (FMC.CACHE_SECONDS).
  // Touch a sentinel key so operators know clear was invoked.
  var cache = CacheService.getScriptCache();
  cache.remove('fmc2:__clear__');
  cache.put('fmc2:__clear__', String(Date.now()), 60);
  SpreadsheetApp.getUi().alert(
    'API cache entries expire automatically (~' +
      Math.round(FMC.CACHE_SECONDS / 60) +
      ' minutes). Redeploy or wait for TTL after sheet edits.'
  );
}
