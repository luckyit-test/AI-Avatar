/**
 * Promo codes database operations
 */
import { db } from './index.js';

const getPromoByCodeStmt = db.prepare(`SELECT * FROM promo_codes WHERE code = ?`);
const insertPromoStmt = db.prepare(`
INSERT INTO promo_codes (code, isActive, maxUses, usedCount, createdAt, updatedAt, expiresAt, note)
VALUES (@code, @isActive, @maxUses, @usedCount, @createdAt, @updatedAt, @expiresAt, @note)
ON CONFLICT(code) DO UPDATE SET
  isActive = excluded.isActive,
  maxUses = excluded.maxUses,
  usedCount = excluded.usedCount,
  updatedAt = excluded.updatedAt,
  expiresAt = excluded.expiresAt,
  note = excluded.note
;
`);
const listPromosStmt = db.prepare(`SELECT * FROM promo_codes ORDER BY createdAt DESC`);
const deletePromoStmt = db.prepare(`DELETE FROM promo_codes WHERE code = ?`);

export function normalizePromoCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function mapPromoRow(row) {
  if (!row) return null;
  return {
    code: row.code,
    isActive: !!row.isActive,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    remainingUses: Math.max(0, (row.maxUses || 0) - (row.usedCount || 0)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt || null,
    note: row.note || null,
  };
}

export function getPromoByCode(code) {
  const row = getPromoByCodeStmt.get(normalizePromoCode(code));
  return mapPromoRow(row);
}

export function savePromo(promo) {
  const now = Date.now();
  insertPromoStmt.run({
    code: normalizePromoCode(promo.code),
    isActive: promo.isActive ? 1 : 0,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount ?? 0,
    createdAt: promo.createdAt ?? now,
    updatedAt: now,
    expiresAt: promo.expiresAt ?? null,
    note: promo.note ?? null,
  });
}

export function listPromos() {
  return listPromosStmt.all().map(mapPromoRow);
}

export { deletePromoStmt };

// In-memory защита от перебора промокодов
export const promoAttemptsByIp = new Map();

