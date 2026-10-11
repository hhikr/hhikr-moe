// Everything you'd want to tweak about the site lives here.

export const SITE = {
  title: 'Hitchhiker',
  shortTitle: 'hhikr',
  url: 'https://hhikr.moe',
  description: 'hhikr 的个人网站：学习笔记、折腾记录与杂谈。',
  lang: 'zh-CN',
  since: 2025,
  /** Show posts marked `draft: true` (with a 草稿 badge) in production builds. */
  showDrafts: true,
} as const;

export const AUTHOR = {
  name: 'hhikr',
  headline: 'Gonna be free, and move among the stars...',
  bio: '未来人，宇宙人或超能力者',
};

export type Social = { label: string; href: string; icon: 'github' | 'bilibili' | 'music' | 'steam' | 'rss' | 'mail' };

export const SOCIALS: Social[] = [
  { label: 'GitHub', href: 'https://github.com/hhikr', icon: 'github' },
  { label: 'Bilibili', href: 'https://space.bilibili.com/533320474', icon: 'bilibili' },
  { label: 'stats.fm', href: 'https://stats.fm/hhikr', icon: 'music' },
  { label: 'Steam', href: 'https://steamcommunity.com/profiles/76561199520017720/', icon: 'steam' },
];

export const NAV = [
  { label: '算法', en: 'Hot 100', href: '/hot100/' },
  { label: '文章', en: 'Posts', href: '/posts/' },
  { label: '合订本', en: 'Series', href: '/series/' },
  { label: '标签', en: 'Tags', href: '/tags/' },
  { label: '关于', en: 'About', href: '/about/' },
];

/** Keys are the `category` values used in front matter. */
export const CATEGORIES: Record<string, { name: string; slug: string; en: string; description: string }> = {
  StudyBase: { name: '学习', slug: 'studybase', en: 'Study', description: '课程笔记与学习记录。' },
  TechPlay: { name: '折腾', slug: 'techplay', en: 'Tinkering', description: '动手折腾：建站、服务器、Linux 与各种小玩意。' },
  Echoes: { name: '杂谈', slug: 'echoes', en: 'Echoes', description: '观影、音乐与随想。' },
};

export const COMMENTS = {
  /** Waline server. Set to '' to disable comments everywhere. */
  walineServer: 'https://waline-comments.hhikr.moe/',
};
