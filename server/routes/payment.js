/**
 * Payment routes
 */
import express from 'express';
import crypto from 'crypto';
import {
  ROBOKASSA_LOGIN,
  ROBOKASSA_PASSWORD1,
  ROBOKASSA_PASSWORD2,
  ROBOKASSA_IS_TEST,
  ROBOKASSA_PAYMENT_AMOUNT,
  ROBOKASSA_PAYMENT_DESC,
  API_PREFIX,
} from '../config/index.js';

const router = express.Router();

// These functions should be imported from db/orders.js and services/payment.js
// For now, they are placeholders that need to be implemented
let createNextInvId, saveOrder, loadOrder, orderImages, generatePortraitsForOrder, MAX_QUEUE_SIZE;

export function initializePaymentRoutes(dependencies) {
  ({ createNextInvId, saveOrder, loadOrder, orderImages, generatePortraitsForOrder, MAX_QUEUE_SIZE } = dependencies);
}

// Инициация платежа
router.post(`${API_PREFIX}/payment/create`, async (req, res) => {
  try {
    // Проверяем, что зависимости инициализированы
    if (typeof createNextInvId !== 'function') {
      console.error('[Robokassa] createNextInvId is not a function');
      return res.status(500).json({ error: 'Ошибка инициализации сервера. Попробуйте позже.' });
    }
    if (typeof saveOrder !== 'function') {
      console.error('[Robokassa] saveOrder is not a function');
      return res.status(500).json({ error: 'Ошибка инициализации сервера. Попробуйте позже.' });
    }
    if (!orderImages || typeof orderImages.set !== 'function') {
      console.error('[Robokassa] orderImages is not initialized');
      return res.status(500).json({ error: 'Ошибка инициализации сервера. Попробуйте позже.' });
    }

    // Проверяем конфигурацию Robokassa
    if (!ROBOKASSA_LOGIN || !ROBOKASSA_PASSWORD1 || !ROBOKASSA_PASSWORD2) {
      console.error('[Robokassa] Missing required configuration:', {
        hasLogin: !!ROBOKASSA_LOGIN,
        hasPassword1: !!ROBOKASSA_PASSWORD1,
        hasPassword2: !!ROBOKASSA_PASSWORD2,
      });
      return res.status(500).json({ error: 'Ошибка конфигурации платежной системы. Обратитесь в поддержку.' });
    }

    const invId = createNextInvId();
    const outSum = ROBOKASSA_PAYMENT_AMOUNT.toFixed(2);

    const { imageData, gender, role, company } = req.body || {};

    const order = {
      invId,
      status: 'created',
      amount: outSum,
      createdAt: Date.now(),
      gender: typeof gender === 'string' ? gender : null,
      role: typeof role === 'string' ? role : null,
      company: typeof company === 'string' ? company : null,
      photoSessionType: 'Деловая фотосессия',
      hasImageData: typeof imageData === 'string' && imageData.length > 0,
      generatedImages: null,
      failureReason: null,
      retries: 0,
    };

    saveOrder(order);

    if (typeof imageData === 'string' && imageData.length > 0) {
      orderImages.set(String(invId), imageData);
    }

    // Формируем подпись для Robokassa
    // Формат: MerchantLogin:OutSum:InvId:Password#1
    const signatureString = `${ROBOKASSA_LOGIN}:${outSum}:${invId}:${ROBOKASSA_PASSWORD1}`;
    const signature = crypto
      .createHash('md5')
      .update(signatureString, 'utf8')
      .digest('hex');

    // Robokassa требует, чтобы Description был закодирован в UTF-8 и затем в URL-кодирование
    const descriptionEncoded = encodeURIComponent(ROBOKASSA_PAYMENT_DESC);
    
    const isTestParam = ROBOKASSA_IS_TEST ? '&IsTest=1' : '';
    const robokassaBaseUrl = 'https://auth.robokassa.ru/Merchant/Index.aspx';
    
    // Формируем URL с правильным кодированием всех параметров
    const redirectUrl =
      `${robokassaBaseUrl}?MerchantLogin=${encodeURIComponent(ROBOKASSA_LOGIN)}` +
      `&OutSum=${outSum}&InvId=${invId}&Description=${descriptionEncoded}&SignatureValue=${signature}${isTestParam}`;

    console.log('[Robokassa] Creating payment:', {
      invId,
      outSum,
      login: ROBOKASSA_LOGIN,
      isTest: ROBOKASSA_IS_TEST,
      signatureString: `${ROBOKASSA_LOGIN}:${outSum}:${invId}:***`,
      signature,
      redirectUrl,
    });

    res.json({ redirectUrl, invId });
  } catch (err) {
    console.error('[Robokassa] payment/create error:', err);
    console.error('[Robokassa] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    res.status(500).json({ error: 'Не удалось создать платёж. Попробуйте позже.' });
  }
});

// Статус платежа
router.get(`${API_PREFIX}/payment/status`, (req, res) => {
  const invId = req.query.invId;
  if (!invId) {
    return res.status(400).json({ paid: false, error: 'invId is required' });
  }
  const order = loadOrder(invId);
  if (!order) {
    return res.json({ paid: false });
  }
  return res.json({ paid: order.status === 'paid' || order.status === 'processing' || order.status === 'completed' });
});

// Robokassa result callback
function handleRobokassaResult(req, res) {
  try {
    console.log('[Robokassa] Result callback received', {
      method: req.method,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      hasQuery: !!req.query,
      queryKeys: req.query ? Object.keys(req.query) : [],
      rawBody: req.body,
      rawQuery: req.query,
    });

    const params = req.method === 'POST' ? req.body : req.query;
    const outSum = params.OutSum;
    const invId = params.InvId;
    const signature = (params.SignatureValue || '').toString().toLowerCase();

    console.log('[Robokassa] Parsed params', {
      outSum,
      invId,
      hasSignature: !!signature,
      signatureLength: signature ? signature.length : 0,
    });

    if (!outSum || !invId || !signature) {
      console.warn('[Robokassa] Missing required params', {
        hasOutSum: !!outSum,
        hasInvId: !!invId,
        hasSignature: !!signature,
        params,
      });
      return res.status(400).send('Bad Request');
    }

    const expectedSignature = crypto
      .createHash('md5')
      .update(`${outSum}:${invId}:${ROBOKASSA_PASSWORD2}`, 'utf8')
      .digest('hex')
      .toLowerCase();

    if (signature !== expectedSignature) {
      return res.status(400).send('Bad signature');
    }

    let order = loadOrder(invId);
    if (!order) {
      order = {
        invId: String(invId),
        status: 'paid',
        amount: outSum,
        createdAt: Date.now(),
        gender: null,
        role: null,
        company: null,
        photoSessionType: 'Деловая фотосессия',
        hasImageData: false,
        generatedImages: null,
        failureReason: null,
        retries: 0,
      };
      saveOrder(order);
    }

    if (order.status === 'created' || order.status === 'paid') {
      order.status = 'paid';
      saveOrder(order);
      
      // Запускаем генерацию портретов
      generatePortraitsForOrder(invId, MAX_QUEUE_SIZE).catch(err => {
        console.error('[Robokassa] Failed to generate portraits:', err);
      });
    }

    res.status(200).send(`OK${invId}`);
  } catch (err) {
    console.error('[Robokassa] Result callback error:', err);
    res.status(500).send('Internal error');
  }
}

// Robokassa может отправлять как POST, так и GET запросы на Result URL
// В настройках магазина указан метод GET, но поддерживаем оба
router.post(`${API_PREFIX}/robokassa/result`, express.urlencoded({ extended: true }), handleRobokassaResult);
router.get(`${API_PREFIX}/robokassa/result`, handleRobokassaResult);

// Payment redirects
router.get('/payment/success', (req, res) => {
  const invId = req.query.InvId || req.query.invId;
  if (!invId) {
    return res.redirect('/?payment=success');
  }
  return res.redirect(`/?payment=success&invId=${encodeURIComponent(invId)}`);
});

router.get('/payment/fail', (req, res) => {
  const invId = req.query.InvId || req.query.invId;
  if (!invId) {
    return res.redirect('/?payment=fail');
  }
  return res.redirect(`/?payment=fail&invId=${encodeURIComponent(invId)}`);
});

export default router;

