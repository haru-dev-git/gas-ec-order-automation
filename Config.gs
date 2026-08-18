/** Shared sheet names and column definitions for the order-processing flow. */
const SHEET_NAMES = {
  ORDERS_RAW: 'orders_raw',
  PRODUCTS: 'products',
  ORDERS_VALID: 'orders_valid',
  ORDERS_ERROR: 'orders_error',
  EXECUTION_LOGS: 'execution_logs'
};

const ORDERS_RAW_HEADERS = [
  'order_id',
  'order_date',
  'customer_name',
  'email',
  'product_code',
  'quantity',
  'unit_price'
];

const PRODUCT_HEADERS = ['product_code', 'product_name', 'unit_price', 'active'];
const ORDERS_VALID_HEADERS = ORDERS_RAW_HEADERS.concat(['product_name', 'validation_status']);
const ORDERS_ERROR_HEADERS = ORDERS_RAW_HEADERS.concat(['error_reasons']);
const EXECUTION_LOG_HEADERS = [
  'run_id',
  'executed_at',
  'total_count',
  'valid_count',
  'error_count',
  'status',
  'message'
];
const LEGACY_EXECUTION_LOG_HEADERS = ['executed_at', 'status', 'message'];

const REQUIRED_SHEET_HEADERS = {};
REQUIRED_SHEET_HEADERS[SHEET_NAMES.ORDERS_RAW] = ORDERS_RAW_HEADERS;
REQUIRED_SHEET_HEADERS[SHEET_NAMES.PRODUCTS] = PRODUCT_HEADERS;
REQUIRED_SHEET_HEADERS[SHEET_NAMES.ORDERS_VALID] = ORDERS_VALID_HEADERS;
REQUIRED_SHEET_HEADERS[SHEET_NAMES.ORDERS_ERROR] = ORDERS_ERROR_HEADERS;
REQUIRED_SHEET_HEADERS[SHEET_NAMES.EXECUTION_LOGS] = EXECUTION_LOG_HEADERS;
