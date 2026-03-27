import type { MenuData } from '@/lib/types';

export const menuItems: MenuData = {
  cryptocurrencies: {
    multiSubmenu: false,
    list: [
      {
        items: [
          { icon: '', lucideIcon: 'trophy', text: 'Ranking', link: '/' },
          { icon: '', lucideIcon: 'layout-grid', text: 'Categories', link: '/categories' },
          { icon: '', lucideIcon: 'flame', text: 'Heatmap', link: '/heatmap' },
          { icon: '', lucideIcon: 'circle-dot', text: 'Bubbles', link: '/bubbles' },
          { icon: '', lucideIcon: 'trending-up', text: 'Gainers & Losers', link: '/gainers-losers' },
          { icon: '', lucideIcon: 'flame', text: 'DEX Screener', link: '/screener' },
          { icon: '', lucideIcon: 'rocket', text: 'Token Discovery', link: '/new-pairs' },
          { icon: '', lucideIcon: 'newspaper', text: 'News', link: '/news' },
        ],
      },
    ],
  },
  assets: {
    multiSubmenu: false,
    list: [
      {
        items: [
          { icon: '', lucideIcon: 'bar-chart-3', text: 'US Equities', link: '/stocks' },
          { icon: '', lucideIcon: 'gem', text: 'Metals', link: '/stocks?tab=metals' },
          { icon: '', lucideIcon: 'fuel', text: 'Commodities', link: '/stocks?tab=commodities' },
          { icon: '', lucideIcon: 'banknote', text: 'Forex', link: '/stocks?tab=forex' },
        ],
      },
    ],
  },
  trading: {
    multiSubmenu: true,
    list: [
      {
        category: 'Trade',
        items: [
          { icon: '', lucideIcon: 'arrow-left-right', text: 'Swap', link: '/swap' },
          { icon: '', lucideIcon: 'pie-chart', text: 'Portfolio', link: '/portfolio' },
          { icon: '', lucideIcon: 'sprout', text: 'DeFi Yields', link: '/yields' },
          { icon: '', lucideIcon: 'calculator', text: 'Converter', link: '/converter' },
          { icon: '', lucideIcon: 'unlock', text: 'Token Unlocks', link: '/unlocks', degenOnly: true },
        ],
      },
      {
        category: 'Analytics',
        items: [
          { icon: '', lucideIcon: 'gauge', text: 'Fear & Greed', link: '/fear-greed' },
          { icon: '', lucideIcon: 'zap', text: 'AI Digest', link: '/digest' },
          { icon: '', lucideIcon: 'layout-dashboard', text: 'Multi-Chart', link: '/multi-chart', degenOnly: true },
          { icon: '', lucideIcon: 'grid-3x3', text: 'Correlation', link: '/correlation', degenOnly: true },
          { icon: '', lucideIcon: 'arrow-left-right', text: 'Compare', link: '/compare', degenOnly: true },
          { icon: '', lucideIcon: 'bar-chart-3', text: 'Analytics', link: '/analytics', degenOnly: true },
          { icon: '', lucideIcon: 'calendar', text: 'Eco Calendar', link: '/calendar', degenOnly: true },
          { icon: '', lucideIcon: 'flame', text: 'Polls', link: '/polls', degenOnly: true },
        ],
      },
    ],
  },
  community: {
    multiSubmenu: false,
    list: [
      {
        items: [
          { icon: '', lucideIcon: 'brand-discord', text: 'Discord', link: 'https://discord.gg/PythNetwork' },
          { icon: '', lucideIcon: 'brand-telegram', text: 'Telegram', link: 'https://t.me/pythnetwork' },
          { icon: '', lucideIcon: 'brand-x', text: 'X (Twitter)', link: 'https://x.com/PythNetwork' },
          { icon: '', lucideIcon: 'brand-instagram', text: 'Instagram', link: 'https://instagram.com/pythnetwork' },
        ],
      },
    ],
  },
};
