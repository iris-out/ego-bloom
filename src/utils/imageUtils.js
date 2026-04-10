/** Proxies image URLs through dev server to avoid CORS and support multiple origins */
export function proxyImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('/zeta-image') || url.startsWith('/zeta-s3')) return url;
  if (url.startsWith('https://image.zeta-ai.io')) {
    return url.replace('https://image.zeta-ai.io', '/zeta-image');
  }
  if (url.startsWith('https://zeta-image.s3.ap-northeast-2.amazonaws.com')) {
    return url.replace('https://zeta-image.s3.ap-northeast-2.amazonaws.com', '/zeta-s3');
  }
  return url;
}

/**
 * Proxies image URL and appends a width hint for CDN-side resize.
 * S3 assets don't support query-string resize — returned as-is.
 * @param {string} url - original image URL
 * @param {number} width - desired pixel width (default 128)
 */
export function proxyThumbnailUrl(url, width = 128) {
  const proxied = proxyImageUrl(url);
  if (!proxied) return null;
  if (proxied.startsWith('/zeta-s3')) return proxied;
  const sep = proxied.includes('?') ? '&' : '?';
  return `${proxied}${sep}width=${width}`;
}

/** Collects all candidate image URLs from plot, in order of preference. All proxied. */
function collectPlotImageUrls(plot) {
  if (!plot) return [];
  const raw = [
    plot.imageUrl,
    plot.characters?.[0]?.imageUrl,
    plot.initialRoomImageUrl,
    ...(plot.characters || []).map(c => c?.imageUrl).filter(Boolean),
  ].filter(Boolean);
  const seen = new Set();
  return raw
    .map(proxyImageUrl)
    .filter(u => u && !seen.has(u) && (seen.add(u), true));
}

/** Primary image URL for plot */
export function getPlotImageUrl(plot) {
  const urls = collectPlotImageUrls(plot);
  return urls[0] || null;
}

/** All image URLs for fallback chain */
export function getPlotImageUrls(plot) {
  return collectPlotImageUrls(plot);
}
