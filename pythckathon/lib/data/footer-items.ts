import type { FooterData } from '@/lib/types';

export const footerItems: FooterData = {
  products: [
    { text: 'Portfolio Tracker', url: '/portfolio' },
    { text: 'DEX Swap', url: '/swap' },
    { text: 'Price Alerts', url: '/portfolio?tab=alerts' },
    { text: 'DeFi Yields', url: '/yields' },
    { text: 'Heatmap', url: '/heatmap' },
    { text: 'Bubble Map', url: '/bubbles' },
  ],
  tools: [
    { text: 'Multi-Chart', url: '/multi-chart' },
    { text: 'Correlation', url: '/correlation' },
    { text: 'Converter', url: '/converter' },
    { text: 'Token Unlocks', url: '/unlocks' },
    { text: 'AI Digest', url: '/digest' },
    { text: 'DEX Screener', url: '/screener' },
  ],
  resources: [
    { text: 'Methodology', url: '' },
    { text: 'Glossary', url: '' },
    { text: 'FAQ', url: '' },
    { text: 'Fear & Greed', url: '/fear-greed' },
    { text: 'Eco Calendar', url: '/calendar' },
  ],
  community: [
    { text: 'Discord', url: 'https://discord.gg/PythNetwork' },
    { text: 'Telegram', url: 'https://t.me/pythnetwork' },
    { text: 'X (Twitter)', url: 'https://x.com/PythNetwork' },
    { text: 'Instagram', url: 'https://instagram.com/pythnetwork' },
  ],
};
