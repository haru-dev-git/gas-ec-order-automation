/** Returns the named sheet or stops processing before incorrect output is written. */
function getSheetOrThrow_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('必要なシート「' + sheetName + '」が見つかりません。initializeSheets()を実行してください。');
  }
  return sheet;
}

/** Creates an absent sheet. Existing non-empty sheets are never overwritten here. */
function ensureSheetWithHeaders_(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  assertRequiredHeaders_(sheet, headers);
  return sheet;
}

/** Ensures every required header is present, allowing harmless column reordering. */
function assertRequiredHeaders_(sheet, requiredHeaders) {
  const actualHeaders = getNormalizedHeaders_(sheet);
  if (actualHeaders.length === 0) {
    throw new Error('シート「' + sheet.getName() + '」に必要なヘッダーがありません。');
  }

  assertNoDuplicateHeaders_(sheet, actualHeaders);
  const missingHeaders = requiredHeaders.filter(function(header) {
    return actualHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length > 0) {
    throw new Error('シート「' + sheet.getName() + '」に必要なヘッダーが不足しています: ' + missingHeaders.join(', '));
  }
}

/** Validates a system-managed sheet whose header names and order are fixed. */
function assertExactHeaderSchema_(sheet, expectedHeaders) {
  const actualHeaders = getNormalizedHeaders_(sheet);
  assertNoDuplicateHeaders_(sheet, actualHeaders);

  if (!matchesExactHeaderSchema_(actualHeaders, expectedHeaders)) {
    throw new Error('シート「' + sheet.getName() + '」のヘッダー構成が想定と異なります。');
  }
}

function getNormalizedHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    return [];
  }
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function(value) { return String(value).trim(); });
}

/** Rejects duplicate non-empty header names before an index map can choose one silently. */
function assertNoDuplicateHeaders_(sheet, headers) {
  const seen = new Set();
  const duplicates = new Set();
  headers.forEach(function(header) {
    if (header !== '') {
      if (seen.has(header)) {
        duplicates.add(header);
      }
      seen.add(header);
    }
  });

  if (duplicates.size > 0) {
    throw new Error('シート「' + sheet.getName() + '」に重複ヘッダーがあります: ' + Array.from(duplicates).join(', '));
  }
}

function matchesExactHeaderSchema_(actualHeaders, expectedHeaders) {
  const expectedColumnsMatch = expectedHeaders.every(function(header, index) {
    return actualHeaders[index] === header;
  });
  const hasUnexpectedNonEmptyHeader = actualHeaders.slice(expectedHeaders.length).some(function(header) {
    return header !== '';
  });
  return expectedColumnsMatch && !hasUnexpectedNonEmptyHeader;
}

/** Builds a header-to-column-index map for reading a sheet whose columns may be reordered. */
function getHeaderIndexMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const indexMap = {};
  headers.forEach(function(header, index) {
    indexMap[String(header).trim()] = index;
  });
  return indexMap;
}

/** Creates an output sheet only when absent; existing output headers are never repaired. */
function ensureManagedOutputSheet_(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  assertExactHeaderSchema_(sheet, headers);
  return sheet;
}

/**
 * Accepts the current log header, or safely upgrades the empty legacy 3-column header.
 * Existing log rows are never changed automatically.
 */
function ensureExecutionLogHeaders_(sheet) {
  const headerState = getExecutionLogHeaderState_(sheet);
  if (headerState === 'EMPTY_SHEET' || headerState === 'LEGACY_EMPTY') {
    sheet.getRange(1, 1, 1, EXECUTION_LOG_HEADERS.length).setValues([EXECUTION_LOG_HEADERS]);
  }
}

/** Inspects the log schema without changing it, so callers can validate before output writes. */
function getExecutionLogHeaderState_(sheet) {
  if (sheet.getLastRow() === 0) {
    return 'EMPTY_SHEET';
  }

  const actualHeaders = getNormalizedHeaders_(sheet);
  assertNoDuplicateHeaders_(sheet, actualHeaders);
  if (matchesExactHeaderSchema_(actualHeaders, EXECUTION_LOG_HEADERS)) {
    return 'CURRENT';
  }

  const nonEmptyHeaders = actualHeaders.filter(function(header) { return header !== ''; });
  const isExactEmptyLegacySchema = sheet.getLastRow() === 1
    && nonEmptyHeaders.length === LEGACY_EXECUTION_LOG_HEADERS.length
    && LEGACY_EXECUTION_LOG_HEADERS.every(function(header, index) {
      return actualHeaders[index] === header;
    });
  if (isExactEmptyLegacySchema) {
    return 'LEGACY_EMPTY';
  }

  throw new Error(
    'execution_logsのヘッダーが新しい7列構成ではありません。既存ログを退避してから手動で移行してください。'
  );
}

/** Replaces only prior result values while keeping the output sheet and its formatting. */
function replaceOutputRows_(sheet, headers, rows) {
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}
