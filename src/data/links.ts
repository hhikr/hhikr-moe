// Friends' sites shown on /links/. Add entries here.
export type FriendLink = {
  name: string;
  url: string;
  description?: string;
  /** Optional avatar URL; falls back to the first letter of the name. */
  avatar?: string;
};

export const FRIENDS: FriendLink[] = [
  { name: '半天建站完成', url: 'http://neonfox.voin.ink', description: '推了我一把，让这个网站终于建起来的朋友。' },
];
