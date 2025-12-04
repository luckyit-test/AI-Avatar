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
  retries
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
  @retries
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

  return {
    orders: rows.map(mapOrderRow),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

let nextInvIdCounter = 1;

export function createNextInvId() {
  const timestamp = Date.now();
  const counter = nextInvIdCounter++;
  return `${timestamp}_${counter}`;
}

// In-memory хранилище для исходных изображений
export const orderImages = new Map();

