/**
 * Stub — term tabs are already populated externally.
 * Kept so old Planner menu / triggers do not break.
 */
function SyncSections() {
  SpreadsheetApp.getUi().alert(
    'SyncSections is disabled. This spreadsheet is already populated; ' +
      'Apps Script only serves JSON via doGet. Update the Winter/Spring tabs directly.'
  );
}
