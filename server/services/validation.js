/**
 * Validation services
 */

export function validateImageData(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    return { valid: false, error: 'Отсутствует изображение' };
  }

  // Проверка формата data URL
  const dataUrlMatch = imageData.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!dataUrlMatch) {
    return { valid: false, error: 'Неподдерживаемый формат изображения. Используйте JPG, PNG или WEBP.' };
  }

  const [, mimeType, base64Data] = dataUrlMatch;
  const normalizedMimeType = mimeType.toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${mimeType.toLowerCase()}`;

  // Проверка размера (base64 примерно на 33% больше оригинала)
  const base64Size = (base64Data.length * 3) / 4;
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (base64Size > MAX_SIZE) {
    return { valid: false, error: 'Размер изображения превышает 5MB. Уменьшите изображение и попробуйте снова.' };
  }

  return {
    valid: true,
    mimeType: normalizedMimeType,
    base64Data: base64Data,
  };
}

export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Отсутствует промпт' };
  }

  const MIN_LENGTH = 10;
  const MAX_LENGTH = 5000;

  if (prompt.length < MIN_LENGTH) {
    return { valid: false, error: `Промпт слишком короткий (минимум ${MIN_LENGTH} символов)` };
  }

  if (prompt.length > MAX_LENGTH) {
    return { valid: false, error: `Промпт слишком длинный (максимум ${MAX_LENGTH} символов)` };
  }

  return { valid: true };
}

