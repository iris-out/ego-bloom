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
