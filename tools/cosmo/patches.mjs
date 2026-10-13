// The few places where Cosmo's renderer differs from Hermes Desktop's, applied
// to the source as it is read during the build. The upstream checkout itself is
// never edited.
//
// Each patch names the file it is for and the exact text it replaces. A patch
// whose text is no longer there fails the build: after a Hermes upgrade that is
// the moment to look at what upstream changed, not something to find out later
// from a feature that quietly went missing.

const PATCHES = [
  {
    // "Saved to memory" rows could not be opened. Upstream shows only the
    // result's `message` for the memory tool, to keep the usage counters and the
    // operations array out of the transcript, and a successful write has no
    // message, so the row had nothing to expand to. Show what was written.
    name: 'memory rows expand to what was remembered',
    file: 'src/components/assistant-ui/tool/fallback-model/index.ts',
    find: /(if \(part\.toolName === 'memory'\) \{\s*(?:\/\/[^\n]*\n\s*)*)return firstStringField\(resultRecord, \['message', 'error'\]\)/,
    replace: (_, head) => `${head}return cosmoMemoryDetail(argsRecord, resultRecord)`,
    prepend: "import { getRuntimeI18nLocale as cosmoLocale } from '@/i18n/runtime'\n",
    append: `
const cosmoChinese = () => String(cosmoLocale()).toLowerCase().startsWith('zh')

function cosmoMemoryDetail(argsRecord: Record<string, unknown>, resultRecord: Record<string, unknown>): string {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  // One line per operation, as a Markdown list item; an entry that runs over
  // several lines stays inside its item.
  const item = (mark: string, body: string) => \`- **\${mark}** \${body.replace(/\\n/g, '\\n  ')}\`

  const batch = Array.isArray(argsRecord.operations) ? argsRecord.operations.map(parseMaybeObject) : []
  const operations = batch.length > 0 ? batch : [argsRecord]

  const lines = operations.flatMap(operation => {
    const content = text(operation.content) || text(operation.new_text)
    const old = text(operation.old_text)

    switch (operation.action) {
      case 'add':
        return content ? [item('+', content)] : []
      case 'replace':
        return content ? [item('~', old ? \`\${content}\\n(\${old})\` : content)] : []
      case 'remove':
        return old ? [item('−', old)] : []
      default:
        return []
    }
  })

  // Which of the two stores this went to; the total in the row's title counts
  // that store alone.
  const user = (text(argsRecord.target) || text(resultRecord.target)) === 'user'
  const store = cosmoChinese() ? (user ? '用户档案' : '笔记') : user ? 'User profile' : 'Notes'
  const written = lines.length > 0 ? \`**\${store}**\\n\\n\${lines.join('\\n')}\` : ''

  return [written, firstStringField(resultRecord, ['message', 'error'])].filter(Boolean).join('\\n\\n')
}
`
  },
  {
    // The number after "Saved to memory" is how many entries the store holds
    // once the write is done, not how many this write made. Upstream prints it
    // as "3 entries", which reads as the latter.
    name: 'memory rows say their count is a total',
    file: 'src/components/assistant-ui/tool/fallback-model/index.ts',
    find: /countLabel: resultCount \? formatCountLabel\(resultCount\) : undefined,/,
    replace: () =>
      "countLabel: resultCount ? (part.toolName === 'memory' ? cosmoMemoryTotal(resultCount.count) : formatCountLabel(resultCount)) : undefined,",
    append: `
function cosmoMemoryTotal(count: number): string {
  return cosmoChinese() ? \`共 \${count} 条\` : \`\${count} in total\`
}
`
  },

  // The renderer is keyboard-first: it hands the caret back to the composer
  // whenever it can (after a click that lands on nothing focusable, a menu
  // closing, a session opening, the pointer moving over a pane), so that
  // typing always goes somewhere. On a phone the same courtesy opens the
  // on-screen keyboard over half the screen after every tap. Where there is no
  // hover and no hardware keyboard to serve, the composer takes focus only
  // when it is tapped. One patch at the function every such request ends in,
  // two at the pointer-following code that reaches around it.
  {
    name: 'composer is not focused by the app on touch screens',
    file: 'src/app/chat/composer/focus.ts',
    find: /export const focusComposerInput = \(el: HTMLElement \| null\) => \{\r?\n  if \(!el\) \{/,
    replace: match => match.replace('if (!el) {', "if (!el || window.matchMedia('(hover: none)').matches) {")
  },
  {
    name: 'no focus-follows-pointer on touch screens (redirect)',
    file: 'src/app/chat/composer/floating-target.ts',
    find: /function focusSelectedComposer\(\) \{\r?\n  const owner = \$floatingComposerOwner\.get\(\)\r?\n/,
    replace: match => `${match}\n  if (cosmoNoHover()) {\n    return\n  }\n`,
    append: `
const cosmoNoHover = () => window.matchMedia('(hover: none)').matches
`
  },
  {
    name: 'no focus-follows-pointer on touch screens (focusin)',
    file: 'src/app/chat/composer/floating-target.ts',
    find: /if \(keyboardNavigation \|\| keepsOwnFocus\(target\) \|\|/,
    replace: () => 'if (cosmoNoHover() || keyboardNavigation || keepsOwnFocus(target) ||'
  },

  // An MCP server that cannot be reached raises a warning toast with "View"
  // and "Disable" buttons. This site's one custom server is the owner's own
  // PC, reached over a tunnel, and that PC is off as often as it is on: its
  // absence is the normal case, not news. The connectors page still marks the
  // server as failing. A server whose sign-in has expired still gets its
  // toast: that one does not fix itself.
  {
    name: 'no toast for an unreachable MCP server',
    file: 'src/store/mcp-health.ts',
    find: /if \(!shouldNotify\(previous, status, snoozedUntil\(key\), Date\.now\(\)\)\) \{/,
    replace: () => "if (status !== 'needs-auth' || !shouldNotify(previous, status, snoozedUntil(key), Date.now())) {"
  },

  // The terminal's status line has two readouts the desktop status bar lacks:
  // the rolling latency of model calls (◷) and the time since the last reply
  // finished (✓). The backend already sends the first with every usage report;
  // the second is this window's own clock. Three patches to one file: the
  // state, the two items, and the items' memo dependencies.
  {
    name: 'status bar tracks when the last turn ended',
    file: 'src/app/shell/hooks/use-statusbar-items.tsx',
    find: /const turnStartedAt = primaryFocused \? primaryTurnStartedAt : focusedTurnStartedAt\r?\n/,
    replace: match => `${match}  const cosmoIdleSince = useCosmoIdleSince(busy, activeSessionId)\n`,
    prepend:
      "import { useEffect as cosmoUseEffect, useRef as cosmoUseRef, useState as cosmoUseState } from 'react'\n" +
      "import { getRuntimeI18nLocale as cosmoLocale } from '@/i18n/runtime'\n",
    append: `
const cosmoChinese = () => String(cosmoLocale()).toLowerCase().startsWith('zh')

/** When the session in view last went from working to idle, as seen by this
 *  window: null until a turn ends here, and again after switching session. */
function useCosmoIdleSince(busy: boolean, sessionId: null | string): null | number {
  const [since, setSince] = cosmoUseState<null | number>(null)
  const previous = cosmoUseRef({ busy, sessionId })

  cosmoUseEffect(() => {
    const before = previous.current
    previous.current = { busy, sessionId }

    if (before.sessionId !== sessionId) {
      setSince(null)
    } else if (before.busy && !busy) {
      setSince(Date.now())
    }
  }, [busy, sessionId])

  return since
}

function cosmoLatencyLabel(usage: UsageStats): string {
  const seconds = (usage as { avg_latency_s?: unknown }).avg_latency_s

  return typeof seconds === 'number' && Number.isFinite(seconds) ? \`\${seconds.toFixed(1)}s\` : ''
}
`
  },
  {
    name: 'status bar shows latency and idle time',
    file: 'src/app/shell/hooks/use-statusbar-items.tsx',
    find: /toggleLabel: copy\.toggleCacheHitRate,\s*variant: 'text'\s*\},\r?\n/,
    replace: match => `${match}      {
        icon: <Clock className="size-3" />,
        id: 'cosmo-latency',
        label: cosmoLatencyLabel(currentUsage) || '—',
        title: cosmoChinese() ? '最近几次模型调用的平均响应时间' : 'Rolling average latency of model calls',
        toggleLabel: cosmoChinese() ? '平均延迟' : 'Average latency',
        variant: 'text'
      },
      {
        detail: <LiveDuration since={cosmoIdleSince} />,
        hidden: busy || !cosmoIdleSince,
        icon: <span aria-hidden="true">✓</span>,
        id: 'cosmo-idle',
        title: cosmoChinese() ? '上一次回复结束后经过的时间' : 'Time since the last reply finished',
        toggleLabel: cosmoChinese() ? '空闲计时' : 'Idle time',
        variant: 'text'
      },
`
  },
  {
    // Ten cells of bar are a third of a phone's width; five say the same thing
    // and leave the cache and latency readouts on screen beside it.
    name: 'context bar is shorter on a phone',
    file: 'src/lib/statusbar.tsx',
    find: /\[\$\{contextBar\(usage\.context_percent\)\}\]/,
    replace: () => "[${contextBar(usage.context_percent, window.matchMedia('(max-width: 40rem)').matches ? 5 : 10)}]"
  },
  {
    name: 'status bar items follow the new readouts',
    file: 'src/app/shell/hooks/use-statusbar-items.tsx',
    find: /\n([ \t]*)cacheHit,\r?\n/,
    replace: (_, indent) => `\n${indent}cacheHit,\n${indent}cosmoIdleSince,\n${indent}currentUsage,\n`
  }
]

/** A Vite plugin that applies the patches, and fails the build for any that did not apply. */
export function cosmoPatches() {
  const applied = new Set()

  return {
    name: 'cosmo:patches',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replaceAll('\\', '/')
      let out = code

      for (const patch of PATCHES) {
        if (!file.endsWith(`/apps/desktop/${patch.file}`)) continue
        if (!patch.find.test(out)) throw new Error(`Cosmo patch "${patch.name}" no longer matches ${patch.file}`)
        out = (patch.prepend ?? '') + out.replace(patch.find, patch.replace) + (patch.append ?? '')
        applied.add(patch.name)
      }

      return out === code ? null : { code: out, map: null }
    },
    buildEnd(error) {
      if (error) return
      const missed = PATCHES.filter(patch => !applied.has(patch.name))
      if (missed.length > 0) throw new Error(`Cosmo patches never reached their file: ${missed.map(patch => patch.name).join(', ')}`)
    }
  }
}
