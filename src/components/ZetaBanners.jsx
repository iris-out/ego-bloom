import React, { useState, useEffect } from 'react';
import { proxyImageUrl } from '../utils/imageUtils';

export default function ZetaBanners() {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const res = await fetch('/api/zeta/banners');
                if (res.ok) {
                    const data = await res.json();
                    setBanners(data.banners || []);
                }
            } catch (e) {
                console.error('Failed to fetch banners', e);
            } finally {
                setLoading(false);
            }
        };
        fetchBanners();
    }, []);

    if (loading || banners.length === 0) return null;

    return (
        <div className="w-full max-w-md mt-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    📣 Zeta 소식 & 공지사항
                </h3>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory custom-scrollbar">
                {banners.map((banner) => {
                    const isUrl = banner.clickAction?.type === 'externalLink';
                    const href = isUrl ? banner.clickAction.url : `https://zeta-ai.io${banner.clickAction?.href || ''}`;

                    return (
                        <a
                            key={banner.id}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative flex-none w-[280px] h-[100px] sm:w-[320px] rounded-xl overflow-hidden snap-center border border-[var(--border)] group hover:border-[var(--accent)] transition-all"
                        >
                            {banner.imageUrl ? (
                                <>
                                    <img
                                        src={proxyImageUrl(banner.imageUrl)}
                                        alt={banner.titlePrimary}
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                </>
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)] flex items-center justify-center">
                                    <span className="text-4xl opacity-10">💬</span>
                                </div>
                            )}

                            <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end">
                                <h4 className="text-sm font-bold text-white leading-tight drop-shadow-md truncate">
                                    {banner.titlePrimary}
                                </h4>
                                {banner.titleSecondary && banner.titleSecondary.trim() !== '' && (
                                    <p className="text-[10px] text-gray-200 mt-0.5 drop-shadow-sm truncate">
                                        {banner.titleSecondary}
                                    </p>
                                )}
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
