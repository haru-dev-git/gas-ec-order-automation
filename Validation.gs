/** Returns true for null, undefined, empty strings, and strings containing only spaces. */
function isBlank_(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function isCompletelyBlankRow_(row) {
  return row.every(isBlank_);
}

function normalizeText_(value) {
  return isBlank_(value) ? '' : String(value).trim();
}

function toFiniteNumber_(value) {
  if (isBlank_(value)) {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isBasicEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText_(value));
}

function isActiveProduct_(value) {
  return value === true || normalizeText_(value).toUpperCase() === 'TRUE';
}

/** Finds every non-empty order ID that occurs more than once in orders_raw. */
function findDuplicateOrderIds_(orders) {
  const counts = new Map();
  orders.forEach(function(order) {
    const orderId = normalizeText_(order.order_id);
    if (orderId !== '') {
      counts.set(orderId, (counts.get(orderId) || 0) + 1);
    }
  });

  const duplicates = new Set();
  counts.forEach(function(count, orderId) {
    if (count > 1) {
      duplicates.add(orderId);
    }
  });
  return duplicates;
}

/** Validates one order and collects every independently detectable problem. */
function validateOrder_(order, duplicateOrderIds, productMap) {
  const errors = [];
  ORDERS_RAW_HEADERS.forEach(function(header) {
    if (isBlank_(order[header])) {
      errors.push(header + 'は必須です。');
    }
  });

  const orderId = normalizeText_(order.order_id);
  if (orderId !== '' && duplicateOrderIds.has(orderId)) {
    errors.push('order_idがorders_raw内で重複しています。');
  }

  const quantity = toFiniteNumber_(order.quantity);
  if (!isBlank_(order.quantity)) {
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1) {
      errors.push('quantityは1以上の整数である必要があります。');
    }
  }

  const unitPrice = toFiniteNumber_(order.unit_price);
  if (!isBlank_(order.unit_price)) {
    if (unitPrice === null || unitPrice <= 0) {
      errors.push('unit_priceは0より大きい数値である必要があります。');
    }
  }

  if (!isBlank_(order.email) && !isBasicEmail_(order.email)) {
    errors.push('emailの形式が不正です。');
  }

  const productCode = normalizeText_(order.product_code);
  const product = productCode === '' ? null : productMap.get(productCode);
  if (productCode !== '') {
    if (!product) {
      errors.push('product_codeに対応する商品がproductsに存在しません。');
    } else {
      if (!isActiveProduct_(product.active)) {
        errors.push('指定された商品は現在販売停止です。');
      }
      if (unitPrice !== null && unitPrice > 0 && unitPrice !== toFiniteNumber_(product.unit_price)) {
        errors.push('unit_priceがproductsの商品マスタ価格と一致しません。');
      }
    }
  }

  return { errors: errors, product: product };
}
