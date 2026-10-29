const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

// Разрешаем только безопасные протоколы (без javascript:, data: и т.п.).
export const isAllowedLink = (url: string) => {
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

// «example.com» → «https://example.com», «user@mail.uz» → «mailto:user@mail.uz».
export const normalizeLink = (value: string) => {
  const url = value.trim();
  if (!url) return '';
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return url;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
};
