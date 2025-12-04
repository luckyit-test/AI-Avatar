/**
 * Admin routes
 */
import express from 'express';
import crypto from 'crypto';
import { join, basename } from 'path';
import { API_PREFIX, IMAGE_ROOT_DIR } from '../config/index.js';
import { requireAdminAuth, getAdminSessionFromRequest, createAdminSession, deleteAdminSession } from '../middleware/auth.js';
import { getAdminSettingsStmt } from '../db/index.js';

const router = express.Router();

// Dependencies that need to be injected
let listOrders, loadOrder, listPromos, getPromoByCode, savePromo, normalizePromoCode, deletePromoStmt;
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function initializeAdminRoutes(dependencies) {
  ({ listOrders, loadOrder, listPromos, getPromoByCode, savePromo, normalizePromoCode, deletePromoStmt } = dependencies);
}

// Admin login
router.post(`${API_PREFIX}/admin/login`, express.json(), (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Пароль обязателен' });
    }

    const settings = getAdminSettingsStmt.get();
    if (!settings) {
      console.error('[Admin] admin_settings row not found');
      return res.status(500).json({ error: 'Настройки админа не найдены' });
    }

    const hash = crypto.scryptSync(password, settings.salt, 64).toString('hex');
    if (hash !== settings.passwordHash) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const token = createAdminSession();
    const now = Date.now();

    res.setHeader(
      'Set-Cookie',
      `admin_session=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(
        ADMIN_SESSION_TTL_MS / 1000
      )}; SameSite=Lax`
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Login error:', err);
    res.status(500).json({ error: 'Ошибка входа администратора' });
  }
});

// Admin logout
router.post(`${API_PREFIX}/admin/logout`, (req, res) => {
  try {
    const session = getAdminSessionFromRequest(req);
    if (session && session.token) {
      deleteAdminSession(session.token);
    }
    res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Logout error:', err);
    res.status(500).json({ error: 'Ошибка выхода администратора' });
  }
});

// Check admin session
router.get(`${API_PREFIX}/admin/me`, (req, res) => {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ ok: false });
  }
  return res.json({ ok: true });
});

// List orders
router.get(`${API_PREFIX}/admin/orders`, requireAdminAuth, (req, res) => {
  try {
    const { from, to, status, page, limit } = req.query;
    const filters = {};
    if (from) {
      const fromNum = Number(from);
      if (!Number.isNaN(fromNum) && fromNum > 0) filters.from = fromNum;
    }
    if (to) {
      const toNum = Number(to);
      if (!Number.isNaN(toNum) && toNum > 0) filters.to = toNum;
    }
    if (status && typeof status === 'string') {
      filters.status = status;
    }

    const pagination = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    };

    const result = listOrders(filters, pagination);
    res.json(result);
  } catch (err) {
    console.error('[Admin] Failed to list orders:', err);
    res.status(500).json({ error: 'Не удалось загрузить список заказов' });
  }
});

// List promo codes
router.get(`${API_PREFIX}/admin/promocodes`, requireAdminAuth, (req, res) => {
  try {
    const promos = listPromos();
    res.json({ promos });
  } catch (err) {
    console.error('[Admin] Failed to list promo codes:', err);
    res.status(500).json({ error: 'Не удалось загрузить список промокодов' });
  }
});

// Create/update promo code
router.post(`${API_PREFIX}/admin/promocodes`, express.json(), requireAdminAuth, (req, res) => {
  try {
    const { code, maxUses, isActive, expiresAt, note } = req.body || {};
    const normalized = normalizePromoCode(code);
    if (!normalized || normalized.length !== 6 || !/^[A-Z0-9]{6}$/.test(normalized)) {
      return res.status(400).json({ error: 'Промокод должен состоять из 6 символов (латинские буквы и цифры)' });
    }
    const maxUsesNum = Number(maxUses) || 0;
    if (maxUsesNum <= 0) {
      return res.status(400).json({ error: 'Максимальное количество активаций должно быть больше 0' });
    }
    const existing = getPromoByCode(normalized);
    const promo = {
      code: normalized,
      isActive: isActive !== false,
      maxUses: maxUsesNum,
      usedCount: existing?.usedCount ?? 0,
      createdAt: existing?.createdAt ?? Date.now(),
      expiresAt: expiresAt ? Number(expiresAt) : null,
      note: note || existing?.note || null,
    };
    savePromo(promo);
    res.json({ promo: getPromoByCode(normalized) });
  } catch (err) {
    console.error('[Admin] Failed to create/update promo code:', err);
    res.status(500).json({ error: 'Не удалось сохранить промокод' });
  }
});

// Delete promo code
router.delete(`${API_PREFIX}/admin/promocodes/:code`, requireAdminAuth, (req, res) => {
  try {
    const code = normalizePromoCode(req.params.code);
    deletePromoStmt.run(code);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] Failed to delete promo code:', err);
    res.status(500).json({ error: 'Не удалось удалить промокод' });
  }
});

// Get order images
router.get(`${API_PREFIX}/admin/orders/:invId/images`, requireAdminAuth, (req, res) => {
  try {
    const { invId } = req.params;
    const order = loadOrder(invId);
    if (!order || !order.generatedImages) {
      return res.status(404).json({ error: 'Изображения не найдены' });
    }
    res.json({ invId: order.invId, images: order.generatedImages });
  } catch (err) {
    console.error('[Admin] Failed to get order images:', err);
    res.status(500).json({ error: 'Не удалось загрузить изображения заказа' });
  }
});

// Download order archive (admin)
router.get(`${API_PREFIX}/admin/orders/:invId/download`, requireAdminAuth, async (req, res) => {
  try {
    const { invId } = req.params;
    const order = loadOrder(invId);
    if (!order || !order.generatedImages) {
      return res.status(404).json({ error: 'Портреты не найдены' });
    }

    const images = order.generatedImages;
    const archiver = (await import('archiver')).default;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="newava_${invId}_portraits.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('[Admin] Archive error:', err);
      try {
        res.status(500).end();
      } catch (_) {}
    });

    archive.pipe(res);

    for (const [style, url] of Object.entries(images)) {
      if (typeof url !== 'string') continue;
      const parts = url.split('/images/')[1];
      if (!parts) continue;
      const filePath = join(IMAGE_ROOT_DIR, parts.replace(/^orders\//, 'orders/'));
      const nameInArchive = basename(filePath) || 'portrait.jpg';
      archive.file(filePath, { name: nameInArchive });
    }

    archive.finalize();
  } catch (err) {
    console.error('[Admin] Failed to download order archive:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Не удалось сформировать архив с портретами' });
    }
  }
});

export default router;

