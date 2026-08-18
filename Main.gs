/**
 * Validates current orders_raw rows against products, then replaces the current
 * orders_valid and orders_error result rows with this run's classification.
 */
function processOrders() {
  const runId = Utilities.getUuid();
  const executedAt = new Date();
  let spreadsheet = null;
  let logsSheet = null;

  try {
    spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    logsSheet = getSheetOrThrow_(spreadsheet, SHEET_NAMES.EXECUTION_LOGS);
    const rawSheet = getSheetOrThrow_(spreadsheet, SHEET_NAMES.ORDERS_RAW);
    const productsSheet = getSheetOrThrow_(spreadsheet, SHEET_NAMES.PRODUCTS);
    const validSheet = getSheetOrThrow_(spreadsheet, SHEET_NAMES.ORDERS_VALID);
    const errorSheet = getSheetOrThrow_(spreadsheet, SHEET_NAMES.ORDERS_ERROR);
    assertRequiredHeaders_(rawSheet, ORDERS_RAW_HEADERS);
    assertRequiredHeaders_(productsSheet, PRODUCT_HEADERS);
    assertExactHeaderSchema_(validSheet, ORDERS_VALID_HEADERS);
    assertExactHeaderSchema_(errorSheet, ORDERS_ERROR_HEADERS);
    getExecutionLogHeaderState_(logsSheet);
    ensureExecutionLogHeaders_(logsSheet);

    const orders = readOrders_(rawSheet);
    const productMap = buildProductMap_(productsSheet);
    const duplicateOrderIds = findDuplicateOrderIds_(orders);
    const validRows = [];
    const errorRows = [];

    orders.forEach(function(order) {
      const validation = validateOrder_(order, duplicateOrderIds, productMap);
      const rawValues = ORDERS_RAW_HEADERS.map(function(header) { return order[header]; });

      if (validation.errors.length === 0) {
        validRows.push(rawValues.concat([validation.product.product_name, 'VALID']));
      } else {
        errorRows.push(rawValues.concat([validation.errors.join(' / ')]));
      }
    });

    replaceOutputRows_(validSheet, ORDERS_VALID_HEADERS, validRows);
    replaceOutputRows_(errorSheet, ORDERS_ERROR_HEADERS, errorRows);

    const summary = {
      totalCount: orders.length,
      validCount: validRows.length,
      errorCount: errorRows.length
    };
    const logRow = appendExecutionLog_(logsSheet, runId, executedAt, summary, 'SUCCESS', '注文処理が完了しました。');
    const notification = sendProcessResultEmailSafely_(runId, executedAt, summary, 'SUCCESS', '注文処理が完了しました。');
    if (!notification.sent) {
      updateExecutionLogMessageSafely_(logsSheet, logRow, '注文処理は完了しました。' + notification.message);
    }
  } catch (error) {
    const errorMessage = getErrorMessage_(error);
    saveFailedRunLogSafely_(spreadsheet, logsSheet, runId, executedAt, errorMessage);
    sendProcessResultEmailSafely_(runId, executedAt, null, 'FAILED', errorMessage);
    Logger.log('EC受注処理に失敗しました。run_id=' + runId + ' / ' + errorMessage);
    throw error;
  }
}

/** Reads non-blank order rows while retaining values in the canonical header order. */
function readOrders_(sheet) {
  if (sheet.getLastRow() < 2) {
    return [];
  }

  const headerIndexMap = getHeaderIndexMap_(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  return rows.filter(function(row) {
    return !isCompletelyBlankRow_(row);
  }).map(function(row) {
    const order = {};
    ORDERS_RAW_HEADERS.forEach(function(header) {
      order[header] = row[headerIndexMap[header]];
    });
    return order;
  });
}

/** Loads products into an in-memory lookup keyed by product_code. */
function buildProductMap_(sheet) {
  const productMap = new Map();
  if (sheet.getLastRow() < 2) {
    return productMap;
  }

  const headerIndexMap = getHeaderIndexMap_(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  rows.forEach(function(row, index) {
    if (isCompletelyBlankRow_(row)) {
      return;
    }
    const productCode = normalizeText_(row[headerIndexMap.product_code]);
    if (productCode === '') {
      throw new Error('productsの' + (index + 2) + '行目にproduct_codeがありません。');
    }
    if (productMap.has(productCode)) {
      throw new Error('products内でproduct_code「' + productCode + '」が重複しています。');
    }
    productMap.set(productCode, {
      product_name: row[headerIndexMap.product_name],
      unit_price: row[headerIndexMap.unit_price],
      active: row[headerIndexMap.active]
    });
  });
  return productMap;
}

/** Appends one audit row for each completed or failed processOrders() execution. */
function appendExecutionLog_(sheet, runId, executedAt, summary, status, message) {
  const row = [
    runId,
    executedAt,
    summary ? summary.totalCount : '',
    summary ? summary.validCount : '',
    summary ? summary.errorCount : '',
    status,
    message
  ];
  const targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, EXECUTION_LOG_HEADERS.length).setValues([row]);
  return targetRow;
}

/** Keeps an email delivery problem from changing a completed order-processing result to FAILED. */
function updateExecutionLogMessageSafely_(sheet, row, message) {
  try {
    const messageColumn = EXECUTION_LOG_HEADERS.indexOf('message') + 1;
    sheet.getRange(row, messageColumn).setValue(message);
  } catch (error) {
    Logger.log('メール通知失敗のログ更新にも失敗しました: ' + getErrorMessage_(error));
  }
}

/** Tries to leave a FAILED audit row without hiding the original processing error. */
function saveFailedRunLogSafely_(spreadsheet, knownLogsSheet, runId, executedAt, errorMessage) {
  try {
    const logsSheet = knownLogsSheet || (spreadsheet && spreadsheet.getSheetByName(SHEET_NAMES.EXECUTION_LOGS));
    if (!logsSheet) {
      throw new Error('execution_logsシートが見つかりません。');
    }
    ensureExecutionLogHeaders_(logsSheet);
    appendExecutionLog_(logsSheet, runId, executedAt, null, 'FAILED', errorMessage);
  } catch (logError) {
    Logger.log('FAILEDログの保存に失敗しました: ' + getErrorMessage_(logError));
  }
}

/** Sends only aggregate processing information to the executing user, if available. */
function sendProcessResultEmailSafely_(runId, executedAt, summary, status, message) {
  try {
    const recipient = Session.getEffectiveUser().getEmail();
    if (!recipient) {
      return { sent: false, message: 'メール通知をスキップしました（実行ユーザーのメールアドレスを取得できません）。' };
    }

    const body = [
      'EC受注処理の結果です。',
      'run_id: ' + runId,
      '実行日時: ' + formatExecutedAt_(executedAt),
      'total_count: ' + (summary ? summary.totalCount : '-'),
      'valid_count: ' + (summary ? summary.validCount : '-'),
      'error_count: ' + (summary ? summary.errorCount : '-'),
      'status: ' + status,
      'message: ' + message
    ].join('\n');
    GmailApp.sendEmail(recipient, 'EC受注処理結果：' + status, body);
    return { sent: true, message: '' };
  } catch (emailError) {
    const emailMessage = 'メール通知に失敗しました: ' + getErrorMessage_(emailError);
    Logger.log(emailMessage);
    return { sent: false, message: emailMessage };
  }
}

function formatExecutedAt_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function getErrorMessage_(error) {
  return error && error.message ? error.message : String(error);
}
