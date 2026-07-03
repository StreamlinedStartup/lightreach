/**
 * Split an email reply into its new content and the quoted prior message.
 *
 * Replies embed the message they answer either as an HTML quote container
 * (Gmail's `.gmail_quote`, a `<blockquote>`, or Outlook's `#divRplyFwdMsg`)
 * or, in plain text, below an attribution line ("On <date>, <name> wrote:")
 * / an "Original Message" separator / a run of `>`-prefixed lines.
 *
 * This is display-only best-effort parsing — it never throws and, when it
 * can't find a boundary, returns the whole body as `reply` with `quoted: null`.
 *
 * Pure string work (no DOM), so it runs identically on the server and client.
 */

export interface SplitReply {
  /** The new reply content. HTML fragment when `isHtml`, otherwise plain text. */
  reply: string
  /** The quoted prior message, or null if none was detected / it was empty. */
  quoted: string | null
  /** Whether `reply`/`quoted` are HTML fragments (vs plain text). */
  isHtml: boolean
}

// HTML markers that begin a quoted section, in the order they'd appear.
const HTML_QUOTE_MARKERS: RegExp[] = [
  /<div[^>]*class="[^"]*gmail_quote[^"]*"/i, // Gmail
  /<div[^>]*id="divRplyFwdMsg"/i, // Outlook desktop/web
  /<div[^>]*id="appendonsend"/i, // Outlook (newer)
  /<blockquote/i, // generic / Apple Mail
]

// Plain-text lines that begin a quoted section.
const TEXT_ATTRIBUTION_RE = /^\s*(On .+ wrote:|Le .+ a écrit\s*:|El .+ escribió:)\s*$/i
const TEXT_SEPARATOR_RE = /^\s*(-{2,}\s*Original Message\s*-{2,}|_{5,}|From:\s.+)\s*$/i

/**
 * Does an HTML/text fragment contain any human-readable content, once tags,
 * quote markers and whitespace are removed? Used to discard empty quote
 * containers (e.g. a reply whose quoted block is just `<br>` or `> > >`).
 */
export function hasVisibleContent(fragment: string | null): boolean {
  if (!fragment) return false
  const stripped = fragment
    .replace(/<[^>]+>/g, ' ') // tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, '') // other entities
    .replace(/^[>\s]+$/gm, '') // pure quote-marker lines
    .replace(/\s+/g, '')
  return stripped.length > 0
}

function splitHtml(html: string): { reply: string; quoted: string | null } {
  let idx = -1
  for (const re of HTML_QUOTE_MARKERS) {
    const m = re.exec(html)
    if (m && (idx === -1 || m.index < idx)) idx = m.index
  }
  if (idx === -1) return { reply: html, quoted: null }
  return { reply: html.slice(0, idx), quoted: html.slice(idx) }
}

function splitText(text: string): { reply: string; quoted: string | null } {
  const lines = text.split(/\r?\n/)
  let boundary = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (
      TEXT_ATTRIBUTION_RE.test(line) ||
      TEXT_SEPARATOR_RE.test(line) ||
      line.trimStart().startsWith('>')
    ) {
      boundary = i
      break
    }
  }
  if (boundary === -1) return { reply: text, quoted: null }
  return {
    reply: lines.slice(0, boundary).join('\n'),
    quoted: lines.slice(boundary).join('\n'),
  }
}

/**
 * Split a message body into its reply and quoted parts. Prefers the HTML body
 * when present (richer boundaries), falling back to plain text.
 */
export function splitQuotedReply(
  bodyText: string | null,
  bodyHtml: string | null,
): SplitReply {
  if (bodyHtml && bodyHtml.trim()) {
    const { reply, quoted } = splitHtml(bodyHtml)
    return {
      reply: reply.trim(),
      quoted: hasVisibleContent(quoted) ? quoted!.trim() : null,
      isHtml: true,
    }
  }

  const { reply, quoted } = splitText(bodyText ?? '')
  return {
    reply: reply.trim(),
    quoted: hasVisibleContent(quoted) ? quoted!.trim() : null,
    isHtml: false,
  }
}
