/**
 * Orders database operations
 */
import { db } from './index.js';

const insertOrderStmt = db.prepare(`
INSERT INTO orders (
  invId,
  status,
  amount,
  createdAt,
  gender,
  role,
  company,
  photoSessionType,
  hasImageData,
  generatedImagesJson,
  imagesCount,
  failureReason,
  retries,
  paymentType,
  promoCode
)
VALUES (
  @invId,
  @status,
  @amount,
  @createdAt,
  @gender,
  @role,
  @company,
  @photoSessionType,
  @hasImageData,
  @generatedImagesJson,
  @imagesCount,
  @failureReason,
  @retries,
  @paymentType,
  @promoCode
)
ON CONFLICT(invId) DO UPDATE SET
  status = excluded.status,
  amount = excluded.amount,
  gender = COALESCE(excluded.gender, orders.gender),
  role = COALESCE(excluded.role, orders.role),
  company = COALESCE(excluded.company, orders.company),
  photoSessionType = COALESCE(excluded.photoSessionType, orders.photoSessionType),
  hasImageData = COALESCE(excluded.hasImageData, orders.hasImageData),
  generatedImagesJson = COALESCE(excluded.generatedImagesJson, orders.generatedImagesJson),
  imagesCount = COALESCE(excluded.imagesCount, orders.imagesCount),
  failureReason = excluded.failureReason,
  retries = excluded.retries,
  paymentType = COALESCE(excluded.paymentType, orders.paymentType),
  promoCode = COALESCE(excluded.promoCode, orders.promoCode)
;
`);

const getOrderStmt = db.prepare(`SELECT * FROM orders WHERE invId = ?`);
const updateImagesCountStmt = db.prepare(
  `UPDATE orders SET imagesCount = @imagesCount WHERE invId = @invId`
);

export function saveOrder(order) {
  const imagesCount =
    typeof order.imagesCount === 'number'
      ? order.imagesCount
      : order.generatedImages
      ? Object.keys(order.generatedImages).length
      : 0;

  insertOrderStmt.run({
    invId: String(order.invId),
    status: order.status,
    amount: order.amount ?? null,
    createdAt: order.createdAt ?? Date.now(),
    gender: order.gender ?? null,
    role: order.role ?? null,
    company: order.company ?? null,
    photoSessionType: order.photoSessionType ?? 'Деловая фотосессия',
    hasImageData: order.hasImageData ? 1 : 0,
    generatedImagesJson: order.generatedImages ? JSON.stringify(order.generatedImages) : null,
    imagesCount,
    failureReason: order.failureReason ?? null,
    retries: order.retries ?? 0,
    paymentType: order.paymentType ?? null,
    promoCode: order.promoCode ?? null,
  });
}

export function loadOrder(invId) {
  const row = getOrderStmt.get(String(invId));
  if (!row) return null;
  const imagesFromJson = row.generatedImagesJson ? JSON.parse(row.generatedImagesJson) : null;
  return {
    invId: row.invId,
    status: row.status,
    amount: row.amount,
    createdAt: row.createdAt,
    gender: row.gender,
    role: row.role,
    company: row.company,
    photoSessionType: row.photoSessionType,
    hasImageData: !!row.hasImageData,
    generatedImages: imagesFromJson,
    failureReason: row.failureReason,
    retries: row.retries ?? 0,
    paymentType: row.paymentType || null,
    promoCode: row.promoCode || null,
    imagesCount: row.imagesCount != null ? row.imagesCount : imagesFromJson ? Object.keys(imagesFromJson).length : 0,
  };
}

function mapOrderRow(row) {
  const imagesFromJson = row.generatedImagesJson ? JSON.parse(row.generatedImagesJson) : null;
  return {
    invId: row.invId,
    status: row.status,
    amount: row.amount,
    createdAt: row.createdAt,
    gender: row.gender,
    role: row.role,
    company: row.company,
    photoSessionType: row.photoSessionType,
    hasImageData: !!row.hasImageData,
    generatedImages: imagesFromJson,
    failureReason: row.failureReason,
    retries: row.retries ?? 0,
    paymentType: row.paymentType || null,
    promoCode: row.promoCode || null,
    imagesCount: row.imagesCount != null ? row.imagesCount : imagesFromJson ? Object.keys(imagesFromJson).length : 0,
  };
}

export function listOrders(filters = {}, pagination = {}) {
  const { from, to, status } = filters;
  let whereSql = 'WHERE 1=1';
  const params = {};

  if (from) {
    whereSql += ' AND createdAt >= @from';
    params.from = from;
  }
  if (to) {
    whereSql += ' AND createdAt <= @to';
    params.to = to;
  }
  if (status) {
    whereSql += ' AND status = @status';
    params.status = status;
  }

  const page = Number(pagination.page) > 0 ? Number(pagination.page) : 1;
  const pageSize = Number(pagination.limit) > 0 ? Number(pagination.limit) : 50;
  const offset = (page - 1) * pageSize;

  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM orders ${whereSql}`);
  const countRow = countStmt.get(params) || { count: 0 };
  const total = Number(countRow.count) || 0;

  const dataStmt = db.prepare(
    `SELECT * FROM orders ${whereSql} ORDER BY createdAt DESC LIMIT @limit OFFSET @offset`
  );
  const rows = dataStmt.all({ ...params, limit: pageSize, offset });

  // Миграция: для старых заказов вычисляем imagesCount из JSON и кешируем в БД
  const mapped = rows.map((row) => {
    let imagesCount = row.imagesCount;

    // Для старых заказов, созданных до появления столбца imagesCount,
    // один раз вычисляем количество портретов из JSON и кешируем в БД.
    if (imagesCount == null && row.generatedImagesJson) {
      try {
        const images = JSON.parse(row.generatedImagesJson);
        imagesCount = images && typeof images === 'object' ? Object.keys(images).length : 0;
        if (typeof imagesCount === 'number' && imagesCount > 0) {
          updateImagesCountStmt.run({
            imagesCount,
            invId: row.invId,
          });
        }
      } catch (e) {
        console.warn('[DB] Failed to parse generatedImagesJson for legacy order', row.invId, e);
        imagesCount = 0;
      }
    }

    const mappedRow = mapOrderRow(row);
    // В списке не загружаем сами URL-ы изображений для экономии памяти
    mappedRow.generatedImages = null;
    mappedRow.imagesCount = imagesCount != null ? imagesCount : mappedRow.imagesCount || 0;
    return mappedRow;
  });

  return {
    orders: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

let nextInvIdCounter = 0;

export function createNextInvId() {
  const timestamp = Date.now();
  const counter = nextInvIdCounter++;
  // Робокасса требует исключительно числовой ID в диапазоне 1-9223372036854775807
  // Используем timestamp * 1000 + counter для уникальности в пределах миллисекунды
  // Максимальный timestamp ~1700000000000, * 1000 = 1700000000000000, + counter до 999
  // Итого максимум ~1700000000000999, что намного меньше максимума 9223372036854775807
  const numericId = timestamp * 1000 + (counter % 1000);
  return numericId;
}

// In-memory хранилище для исходных изображений
export const orderImages = new Map();

