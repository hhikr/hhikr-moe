// The comment section: list, composer, and the sign-in prompt that only
// appears when a guest tries to post.
import { api, solveChallenge } from './account';

interface Author {
  nickname: string;
  tag: string;
  handle: string;
  role: 'user' | 'endmin';
  avatar: string | null;
  /** Present only for the signed-in user's own account. */
  login?: 'password' | 'google';
}
interface Comment {
  id: number;
  parentId: number | null;
  html: string;
  createdAt: string;
  author: Author | null;
  mine: boolean;
  status: 'visible' | 'hidden' | 'deleted';
}

const DRAFT = 'comment-draft';
const PENDING = 'comment-send-after-sign-in';

const root = document.querySelector<HTMLElement>('[data-comments]');
if (root) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    init(root);
  };
  // Returning from Google with a comment waiting: load right away.
  if (location.hash === '#comments' || sessionStorage.getItem(PENDING)) start();
  else {
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (io.disconnect(), start()), { rootMargin: '600px' });
    io.observe(root);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  const { class: className, ...rest } = props;
  if (className) node.className = className;
  Object.assign(node, rest);
  node.append(...children);
  return node;
}

const when = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

function avatar(author: Author | null) {
  if (author?.avatar) return el('img', { class: 'c-avatar', src: author.avatar, alt: '', width: 40, height: 40, loading: 'lazy' });
  const name = author?.nickname ?? '?';
  let hue = 0;
  for (const ch of author?.handle ?? '') hue = (hue * 31 + ch.codePointAt(0)!) % 360;
  const box = el('span', { class: 'c-avatar c-initial' }, [...name][0]?.toUpperCase() ?? '?');
  box.style.setProperty('--hue', String(hue));
  return box;
}

function nameOf(author: Author | null) {
  if (!author) return el('span', { class: 'c-name' }, '已删除');
  const name = el('span', { class: 'c-name' }, author.nickname);
  if (author.tag) name.append(el('span', { class: 'c-tag' }, `#${author.tag}`));
  if (author.role === 'endmin') name.append(el('span', { class: 'c-badge' }, 'Endministrator'));
  return name;
}

function init(root: HTMLElement) {
  const slug = root.dataset.slug!;
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const form = root.querySelector<HTMLFormElement>('[data-composer]')!;
  const text = form.querySelector<HTMLTextAreaElement>('textarea')!;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const previewBox = form.querySelector<HTMLElement>('[data-preview]')!;
  const replying = form.querySelector<HTMLElement>('[data-replying]')!;
  const profile = root.querySelector<HTMLElement>('[data-profile]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-auth]')!;

  let me: Author | null = null;
  let comments: Comment[] = [];
  let replyTo: Comment | null = null;

  const say = (message: string) => (status.textContent = message);

  /* ---------- list ---------- */

  function item(c: Comment): HTMLElement {
    const body = el('div', { class: 'c-body' });
    if (c.status === 'deleted') body.append(el('p', { class: 'c-gone' }, '该评论已删除'));
    else body.innerHTML = c.html; // rendered and escaped by the server

    const actions = el('div', { class: 'c-actions' });
    if (c.status !== 'deleted') {
      const reply = el('button', { type: 'button', class: 'c-link' }, '回复');
      reply.addEventListener('click', () => setReply(c));
      actions.append(reply);
      if (c.mine || me?.role === 'endmin') {
        const remove = el('button', { type: 'button', class: 'c-link' }, '删除');
        remove.addEventListener('click', () => removeComment(c));
        actions.append(remove);
      }
    }
    const head = el('div', { class: 'c-head' }, nameOf(c.author), el('time', { dateTime: c.createdAt }, when.format(new Date(c.createdAt))));
    if (c.status === 'hidden') head.append(el('span', { class: 'c-pending' }, '等待审核，目前只有你能看到'));
    const node = el('li', { class: 'c-item', id: `comment-${c.id}` }, avatar(c.author), el('div', { class: 'c-main' }, head, body, actions));
    return node;
  }

  function render() {
    list.replaceChildren();
    const tops = comments.filter((c) => !c.parentId);
    for (const top of tops) {
      const node = item(top);
      const replies = comments.filter((c) => c.parentId === top.id);
      if (replies.length) node.querySelector('.c-main')!.append(el('ol', { class: 'c-replies' }, ...replies.map(item)));
      list.append(node);
    }
    const n = comments.filter((c) => c.status !== 'deleted').length;
    count.textContent = n ? `${n} 条` : '还没有评论';
  }

  /* ---------- profile ---------- */

  function renderProfile() {
    profile.replaceChildren();
    profile.hidden = !me;
    if (!me) return;
    const menu = el('div', { class: 'c-menu' });
    const button = (label: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'c-link' }, label);
      b.addEventListener('click', run);
      return b;
    };
    if (me.role !== 'endmin') menu.append(button('改昵称', rename));
    menu.append(button('换头像', () => picker.click()));
    if (me.avatar) menu.append(button('移除头像', async () => applyUser(await api('/api/me/avatar', undefined, 'DELETE'))));
    if (me.role !== 'endmin') menu.append(button('账号', openAccount));
    menu.append(button('退出', signOut));
    profile.append(avatar(me), el('span', { class: 'c-me' }, '以 ', nameOf(me), ' 的身份评论'), menu);
  }

  function applyUser(res: Awaited<ReturnType<typeof api<{ user: Author }>>>) {
    if (!res.ok) return say(res.error.message);
    me = res.data.user;
    renderProfile();
    load();
  }

  async function rename() {
    const next = prompt('新的昵称（2 到 20 个字符）', me!.nickname)?.trim();
    if (!next || next === me!.nickname) return;
    const res = await api('/api/me', { nickname: next }, 'PATCH');
    applyUser(res);
    if (res.ok) say(`现在的完整名字是 ${res.data.user.handle}，登录时需要用它。`);
  }

  /* ---------- account: password, other devices, deletion ---------- */

  function openAccount() {
    const user = me!;
    const dialog = el('dialog', { class: 'c-auth c-account', ariaLabel: '账号' });
    const close = el('button', { type: 'button', class: 'c-close', ariaLabel: '关闭' }, '×');
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    const note = el('p', { class: 'c-status', role: 'status' });
    const input = (name: string, type: string, autocomplete: string) => el('input', { name, type, autocomplete: autocomplete as AutoFill, maxLength: 200 });
    const field = (label: string, control: HTMLElement, hint?: string) =>
      el('label', { class: 'field' }, el('span', { class: 'label' }, label), control, ...(hint ? [el('small', {}, hint)] : []));
    const section = (title: string, ...children: (Node | string)[]) => el('section', {}, el('h4', { class: 'label' }, title), ...children);
    // Runs a request from a form's submit button, showing what went wrong next to it.
    const submitTo = (form: HTMLFormElement, run: () => Promise<string | undefined>) =>
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector<HTMLButtonElement>('[type=submit]')!;
        button.disabled = true;
        note.textContent = (await run()) ?? '';
        button.disabled = false;
      });

    dialog.append(close, el('h3', {}, '账号'), el('p', { class: 'c-hint' }, '你的完整名字是 ', el('strong', {}, user.handle), '。'));

    if (user.login === 'password') {
      const current = input('current', 'password', 'current-password');
      const next = input('next', 'password', 'new-password');
      const form = el('form', { class: 'form', noValidate: true }, field('当前密码', current), field('新密码', next, '至少 10 个字符。修改后，其他设备上的登录会失效。'), el('button', { type: 'submit', class: 'btn' }, '修改密码'));
      submitTo(form, async () => {
        const res = await api('/api/me/password', { current: current.value, next: next.value });
        if (!res.ok) return res.error.message;
        form.reset();
        return '密码已修改。';
      });
      dialog.append(section('密码', form));
    }

    const elsewhere = el('button', { type: 'button', class: 'btn' }, '退出其他设备');
    elsewhere.addEventListener('click', async () => {
      const res = await api('/api/me/sessions', undefined, 'DELETE');
      note.textContent = res.ok ? '其他设备上的登录已全部退出。' : res.error.message;
    });
    dialog.append(section('登录状态', el('p', { class: 'c-fine' }, '在别的电脑或手机上登录过、现在不再使用时，可以让那些登录全部失效。'), elsewhere));

    const byPassword = user.login === 'password';
    const proof = input('proof', byPassword ? 'password' : 'text', byPassword ? 'current-password' : 'off');
    const remove = el('form', { class: 'form', noValidate: true }, field(byPassword ? '输入密码以确认' : `输入完整的名字 ${user.handle} 以确认`, proof), el('button', { type: 'submit', class: 'btn danger' }, '永久删除账号'));
    submitTo(remove, async () => {
      if (!confirm('删除账号后，你发表的所有评论会一并删除，无法恢复。继续？')) return undefined;
      const res = await api('/api/me', { proof: proof.value }, 'DELETE');
      if (!res.ok) return res.error.message;
      dialog.close();
      me = null;
      renderProfile();
      load();
      say('账号已删除。');
      return undefined;
    });
    dialog.append(section('删除账号', el('p', { class: 'c-fine' }, '账号、头像和你发表的全部评论会立即删除，无法恢复。'), remove), note);

    root.append(dialog);
    dialog.showModal();
  }

  async function signOut() {
    await api('/api/auth/logout', {});
    me = null;
    renderProfile();
    load();
  }

  // Shrink the chosen picture in the browser first; the server re-encodes it again regardless.
  const picker = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  root.append(picker);
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      const image = await createImageBitmap(file);
      const side = Math.min(image.width, image.height);
      const canvas = el('canvas', { width: 256, height: 256 });
      canvas.getContext('2d')!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.85));
      if (!blob) throw new Error();
      say('正在上传头像…');
      const res = await api('/api/me/avatar', blob, 'PUT');
      say(res.ok ? '' : res.error.message);
      applyUser(res);
    } catch {
      say('这张图片无法处理，请换一张。');
    }
  });

  /* ---------- composer ---------- */

  function setReply(c: Comment | null) {
    replyTo = c;
    replying.hidden = !c;
    if (c) {
      replying.querySelector('span')!.textContent = `回复 ${c.author?.nickname ?? ''}`;
      text.focus();
      form.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  replying.querySelector('button')!.addEventListener('click', () => setReply(null));

  // Toolbar: wrap the selection in a tag, or insert an empty pair.
  form.querySelector('[data-tools]')!.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tag]');
    if (!button) return;
    const tag = button.dataset.tag!;
    const { selectionStart: a, selectionEnd: b, value } = text;
    const inner = value.slice(a, b);
    const open = tag === 'url' && inner && !/^https?:\/\//.test(inner) ? '[url=https://]' : `[${tag}]`;
    text.value = value.slice(0, a) + open + inner + `[/${tag}]` + value.slice(b);
    const caret = inner ? a + open.length + inner.length + tag.length + 3 : a + open.length;
    text.focus();
    text.setSelectionRange(caret, caret);
  });

  form.querySelector('[data-preview-toggle]')!.addEventListener('click', async () => {
    if (!previewBox.hidden) return void (previewBox.hidden = true);
    if (!text.value.trim()) return;
    const res = await api('/api/comments/preview', { source: text.value });
    if (!res.ok) return say(res.error.message);
    previewBox.innerHTML = res.data.html;
    previewBox.hidden = false;
  });

  async function send() {
    const source = text.value.trim();
    if (!source) return say('写点什么再发送吧。');
    if (!me) {
      // The only moment a guest is asked to sign in.
      sessionStorage.setItem(DRAFT, JSON.stringify({ slug, source, parentId: replyTo?.id ?? null }));
      openAuth();
      return;
    }
    const button = form.querySelector<HTMLButtonElement>('[type=submit]')!;
    button.disabled = true;
    say('正在发送…');
    try {
      const challenge = await solveChallenge();
      const res = await api('/api/comments', { slug, source, parentId: replyTo?.id, website: form.querySelector<HTMLInputElement>('[name=website]')!.value, challenge });
      if (!res.ok) return say(res.error.message);
      sessionStorage.removeItem(DRAFT);
      text.value = '';
      previewBox.hidden = true;
      setReply(null);
      say(res.data.comment.status === 'hidden' ? '已提交，审核通过后其他人才能看到。' : '');
      comments.push(res.data.comment);
      render();
      document.getElementById(`comment-${res.data.comment.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } finally {
      button.disabled = false;
    }
  }
  form.addEventListener('submit', (e) => (e.preventDefault(), send()));

  async function removeComment(c: Comment) {
    if (!confirm('删除这条评论？')) return;
    const res = await api(`/api/comments/${c.id}`, undefined, 'DELETE');
    if (!res.ok) return say(res.error.message);
    load();
  }

  /* ---------- sign-in prompt ---------- */

  const authForm = dialog.querySelector<HTMLFormElement>('form')!;
  const authMessage = dialog.querySelector<HTMLElement>('[data-auth-message]')!;
  const welcome = dialog.querySelector<HTMLElement>('[data-welcome]')!;
  const google = dialog.querySelector<HTMLAnchorElement>('[data-google]');

  function openAuth() {
    authMessage.textContent = '';
    authForm.hidden = false;
    welcome.hidden = true;
    if (google) google.hidden = false;
    dialog.showModal();
  }
  // Coming back from Google lands on this page again; send the waiting comment then.
  google?.addEventListener('click', () => sessionStorage.setItem(PENDING, '1'));
  dialog.querySelector('[data-auth-close]')!.addEventListener('click', () => dialog.close());

  async function auth(action: 'login' | 'register') {
    const data = new FormData(authForm);
    const name = String(data.get('name') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!name || !password) return void (authMessage.textContent = '请填写名字和密码。');
    const buttons = authForm.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));
    try {
      if (action === 'login') {
        if (!name.includes('#')) return void (authMessage.textContent = '登录时请填写完整的名字，例如 narrator#1145。');
        const res = await api('/api/auth/login', { handle: name, password });
        if (!res.ok) return void (authMessage.textContent = res.error.message);
        me = res.data.user;
        dialog.close();
        await afterSignIn();
        return;
      }
      authMessage.textContent = '正在验证…';
      const res = await api('/api/auth/register', { nickname: name, password, website: data.get('website'), challenge: await solveChallenge() });
      if (!res.ok) return void (authMessage.textContent = res.error.message);
      me = res.data.user;
      // Show the full name before going on: it is needed to sign in next time.
      authMessage.textContent = '';
      authForm.hidden = true;
      if (google) google.hidden = true;
      welcome.querySelector('[data-handle]')!.textContent = res.data.user.handle;
      welcome.hidden = false;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  authForm.addEventListener('submit', (e) => (e.preventDefault(), auth('login')));
  authForm.querySelector('[data-register]')!.addEventListener('click', () => auth('register'));
  welcome.querySelector('button')!.addEventListener('click', async () => {
    dialog.close();
    await afterSignIn();
  });

  async function afterSignIn() {
    renderProfile();
    await load();
    await sendDraft();
  }

  async function sendDraft() {
    sessionStorage.removeItem(PENDING);
    const raw = sessionStorage.getItem(DRAFT);
    if (!raw || !me) return;
    try {
      const draft = JSON.parse(raw);
      if (draft.slug !== slug) return;
      text.value = draft.source;
      replyTo = comments.find((c) => c.id === draft.parentId) ?? null;
      await send();
    } catch {
      sessionStorage.removeItem(DRAFT);
    }
  }

  /* ---------- reading ---------- */

  // Spoilers and image zoom work the same way as in the article above.
  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    target.closest('.spoiler')?.classList.add('revealed');
    const img = target.closest<HTMLImageElement>('.c-body img, [data-preview] img');
    const box = document.querySelector<HTMLDialogElement>('dialog.lightbox');
    if (img && box) {
      box.querySelector('img')!.src = img.src;
      box.querySelector('p')!.textContent = '';
      box.showModal();
    }
  });
  // An image host that is gone should not leave a broken icon behind.
  root.addEventListener(
    'error',
    (e) => {
      const img = e.target as HTMLElement;
      if (img instanceof HTMLImageElement && img.closest('.c-body, [data-preview]')) {
        img.replaceWith(el('span', { class: 'c-broken' }, `图片无法加载：${img.src}`));
      }
    },
    true,
  );

  async function load() {
    const res = await api(`/api/comments?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return void (count.textContent = '评论加载失败');
    comments = res.data.comments;
    form.hidden = !res.data.enabled;
    render();
  }

  (async () => {
    const [who] = await Promise.all([api('/api/me'), load()]);
    if (who.ok) me = who.data.user;
    renderProfile();
    render();
    if (sessionStorage.getItem(PENDING)) await sendDraft();
    else if (!me) {
      // A draft left from an abandoned sign-in is put back for the reader.
      try {
        const draft = JSON.parse(sessionStorage.getItem(DRAFT) ?? 'null');
        if (draft?.slug === slug) text.value = draft.source;
      } catch {}
    }
  })();
}
