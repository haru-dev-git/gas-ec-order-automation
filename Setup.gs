/**
 * Creates the five required sheets and writes headers only to sheets that are empty.
 * Existing sheets with data are validated instead of being cleared.
 */
function initializeSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(REQUIRED_SHEET_HEADERS).forEach(function(sheetName) {
    if (sheetName === SHEET_NAMES.EXECUTION_LOGS) {
      const logSheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
      ensureExecutionLogHeaders_(logSheet);
      return;
    }
    if (sheetName === SHEET_NAMES.ORDERS_VALID || sheetName === SHEET_NAMES.ORDERS_ERROR) {
      ensureManagedOutputSheet_(spreadsheet, sheetName, REQUIRED_SHEET_HEADERS[sheetName]);
      return;
    }
    ensureSheetWithHeaders_(spreadsheet, sheetName, REQUIRED_SHEET_HEADERS[sheetName]);
  });
}
