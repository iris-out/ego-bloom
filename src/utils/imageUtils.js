const IMAGE_ORIGIN = 'https://image.zeta-ai.io';
const S3_ORIGIN = 'https://zeta-image.s3.ap-northeast-2.amazonaws.com';

/**
 * 기본: Zeta CDN에서 직접 로드하는 URL을 반환 (Vercel Fast Data Transfer 대역폭 절약).
 * forExport: true → html-to-image 캡처 또는 canvas 픽셀 읽기용 동일 오리진 프록시 URL 반환.
 */
export function proxyImageUrl(url, { forExport = false } = {}) {
  if (!url) return null;

  if (forExport) {
    if (url.startsWith('/zeta-image') || url.startsWith('/zeta-s3')) return url;
    if (url.startsWith(IMAGE_ORIGIN)) return url.replace(IMAGE_ORIGIN, '/zeta-image');
    if (url.startsWith(S3_ORIGIN)) return url.replace(S3_ORIGIN, '/zeta-s3');
    return url;
  }

  if (url.startsWith('/zeta-image')) return IMAGE_ORIGIN + url.slice('/zeta-image'.length);
  if (url.startsWith('/zeta-s3')) return S3_ORIGIN + url.slice('/zeta-s3'.length);
  return url;
}

/**
 * Proxies image URL and appends a width hint for CDN-side resize.
 * S3 assets don't support query-string resize — returned as-is.
 * @param {string} url - original image URL
 * @param {number} width - desired pixel width (default 128)
 * @param {{forExport?: boolean}} [opts]
 */
export function proxyThumbnailUrl(url, width = 128, opts) {
  const proxied = proxyImageUrl(url, opts);
  if (!proxied) return null;
  if (proxied.startsWith('/zeta-s3') || proxied.startsWith(S3_ORIGIN)) return proxied;
  const sep = proxied.includes('?') ? '&' : '?';
  return `${proxied}${sep}width=${width}`;
}

function collectPlotImageUrls(plot, opts) {
  if (!plot) return [];
  const raw = [
    plot.imageUrl,
    plot.characters?.[0]?.imageUrl,
    plot.initialRoomImageUrl,
    ...(plot.characters || []).map(c => c?.imageUrl).filter(Boolean),
  ].filter(Boolean);
  const seen = new Set();
  return raw
    .map(u => proxyImageUrl(u, opts))
    .filter(u => u && !seen.has(u) && (seen.add(u), true));
}

export function getPlotImageUrl(plot, opts) {
  const urls = collectPlotImageUrls(plot, opts);
  return urls[0] || null;
}

export function getPlotImageUrls(plot, opts) {
  return collectPlotImageUrls(plot, opts);
}
