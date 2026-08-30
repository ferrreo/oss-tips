/**
 * Markdown remains the canonical post format. This small renderer deliberately
 * supports the common post constructs while treating all source HTML as text.
 * It is suitable for server-rendered previews and public post pages; it does
 * not execute arbitrary HTML or create free-form embeds.
 */

export function normalizeMarkdown(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

export type SafeEmbed = {
  provider: 'youtube' | 'vimeo' | 'peertube';
  label: 'YouTube' | 'Vimeo' | 'PeerTube';
  url: string;
};

export type MarkdownRenderLabels = {
  completedTask: string;
  incompleteTask: string;
  openEmbed: (provider: string) => string;
};

const defaultRenderLabels: MarkdownRenderLabels = {
  completedTask: 'Completed task',
  incompleteTask: 'Incomplete task',
  openEmbed: (provider) => `Open ${provider} embed`,
};

export type MarkdownRenderOptions = {
  labels?: Partial<MarkdownRenderLabels>;
};

export type MarkdownAlignment = 'left' | 'center' | 'right' | null;

export type MarkdownInline =
  | { type: 'text'; value: string }
  | { type: 'strong'; delimiter: '**' | '__'; children: MarkdownInline[] }
  | { type: 'emphasis'; delimiter: '*' | '_'; children: MarkdownInline[] }
  | { type: 'code'; delimiter: string; value: string }
  | { type: 'link'; url: string; children: MarkdownInline[]; title?: string }
  | { type: 'image'; url: string; alt: string; title?: string }
  | { type: 'autolink'; url: string }
  | {
      type: 'embed';
      label: string;
      provider: SafeEmbed['provider'];
      url: string;
    };

export type MarkdownListItem = {
  type: 'listItem';
  children: MarkdownInline[];
};

export type MarkdownBlock =
  | { type: 'heading'; level: number; closing: boolean; children: MarkdownInline[] }
  | { type: 'thematicBreak'; marker: string }
  | {
      type: 'codeBlock';
      fenceChar: '`' | '~';
      fenceLength: number;
      language: string;
      value: string;
    }
  | {
      type: 'table';
      headers: MarkdownInline[][];
      alignments: MarkdownAlignment[];
      rows: MarkdownInline[][][];
    }
  | { type: 'blockquote'; children: MarkdownBlock[] }
  | { type: 'list'; ordered: boolean; marker: string; start?: number; items: MarkdownListItem[] }
  | { type: 'footnote'; label: string; children: MarkdownInline[] }
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'raw'; value: string };

export type MarkdownDocument = {
  type: 'root';
  children: MarkdownBlock[];
  trailingNewline: boolean;
};

/** Parse the supported post Markdown subset into an editable AST. */
export function parseMarkdown(source: string): MarkdownDocument {
  const normalized = normalizeMarkdown(source);
  const lines = normalized.split('\n');
  const children: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const marker = fence[1] ?? '```';
      const value: string[] = [];
      const close = new RegExp(`^\\s*${escapeRegExp(marker[0] ?? '`')}{${marker.length},}\\s*$`);
      index += 1;
      while (index < lines.length && !close.test(lines[index] ?? '')) {
        value.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      const info = (fence[2] ?? '').trim();
      children.push({
        type: 'codeBlock',
        fenceChar: marker[0] === '~' ? '~' : '`',
        fenceLength: marker.length,
        language: sanitizeLanguage(info),
        value: value.join('\n'),
      });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const content = heading[2] ?? '';
      const closing = /\s+#+$/.test(content);
      children.push({
        type: 'heading',
        level: heading[1]?.length ?? 1,
        closing,
        children: parseInline(closing ? content.replace(/\s+#+$/, '') : content),
      });
      index += 1;
      continue;
    }

    const thematicBreak = /^\s*(---+|(?:\*\s*){3,}|(?:_\s*){3,})\s*$/.exec(line);
    if (thematicBreak) {
      children.push({ type: 'thematicBreak', marker: thematicBreak[1] ?? '---' });
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index] ?? '').map(parseInline);
      const separator = splitTableRow(lines[index + 1] ?? '');
      const alignments = separator.map((cell): MarkdownAlignment => {
        const value = cell.trim();
        return value.startsWith(':') && value.endsWith(':')
          ? 'center'
          : value.startsWith(':')
            ? 'left'
            : value.endsWith(':')
              ? 'right'
              : null;
      });
      const rows: MarkdownInline[][][] = [];
      index += 2;
      while (
        index < lines.length &&
        (lines[index] ?? '').includes('|') &&
        (lines[index] ?? '').trim()
      ) {
        rows.push(splitTableRow(lines[index] ?? '').map(parseInline));
        index += 1;
      }
      children.push({ type: 'table', headers, alignments, rows });
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^\s*>\s?/, ''));
        index += 1;
      }
      children.push({ type: 'blockquote', children: parseMarkdown(quote.join('\n')).children });
      continue;
    }

    const unordered = /^\s*([-+*])\s+(.+)$/.exec(line);
    const ordered = /^\s*(\d+)([.)])\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const marker = ordered ? (ordered[2] ?? '.') : (unordered?.[1] ?? '-');
      const items: MarkdownListItem[] = [];
      const start = ordered ? Number(ordered[1]) : undefined;
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const match = ordered
          ? /^\s*\d+[.)]\s+(.+)$/.exec(current)
          : /^\s*[-+*]\s+(.+)$/.exec(current);
        if (!match) break;
        items.push({ type: 'listItem', children: parseInline(match[1] ?? '') });
        index += 1;
      }
      children.push({
        type: 'list',
        ordered: orderedList,
        marker,
        ...(start === undefined ? {} : { start }),
        items,
      });
      continue;
    }

    const footnote = /^\[\^([^\]]+)\]:\s+(.+)$/.exec(line);
    if (footnote) {
      children.push({
        type: 'footnote',
        label: footnote[1] ?? '',
        children: parseInline(footnote[2] ?? ''),
      });
      index += 1;
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? '').trim()) {
      if (isBlockStart(lines, index)) break;
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    children.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
  }

  return {
    type: 'root',
    children,
    trailingNewline: normalized.endsWith('\n'),
  };
}

/** Serialize an AST using the canonical Markdown form used by post storage. */
export function serializeMarkdown(document: MarkdownDocument): string {
  const body = serializeBlocks(document.children);
  return document.trailingNewline && body ? `${body}\n` : body;
}

function serializeBlocks(blocks: readonly MarkdownBlock[]): string {
  return blocks.map(serializeBlock).join('\n\n');
}

function serializeBlock(block: MarkdownBlock): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${serializeInline(block.children)}${block.closing ? ' #' : ''}`;
    case 'thematicBreak':
      return block.marker;
    case 'codeBlock': {
      const marker = block.fenceChar.repeat(Math.max(3, block.fenceLength));
      const info = block.language ? block.language : '';
      const content = block.value ? `${block.value}\n` : '';
      return `${marker}${info}\n${content}${marker}`;
    }
    case 'table': {
      const header = formatTableRow(block.headers.map(serializeInline));
      const separator = formatTableRow(
        block.alignments.map((alignment) =>
          alignment === 'center'
            ? ':---:'
            : alignment === 'left'
              ? ':---'
              : alignment === 'right'
                ? '---:'
                : '---',
        ),
      );
      const rows = block.rows.map((row) => formatTableRow(row.map(serializeInline)));
      return [header, separator, ...rows].join('\n');
    }
    case 'blockquote':
      return serializeBlocks(block.children)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'list': {
      const start = block.start ?? 1;
      return block.items
        .map((item, index) =>
          block.ordered
            ? `${start + index}${block.marker} ${serializeInline(item.children)}`
            : `${block.marker} ${serializeInline(item.children)}`,
        )
        .join('\n');
    }
    case 'footnote':
      return `[^${block.label}]: ${serializeInline(block.children)}`;
    case 'paragraph':
      return serializeInline(block.children);
    case 'raw':
      return block.value;
  }
}

function formatTableRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function parseInline(source: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  let index = 0;
  let textStart = 0;
  const flushText = (end: number) => {
    if (end > textStart) nodes.push({ type: 'text', value: source.slice(textStart, end) });
  };
  const add = (node: MarkdownInline, length: number) => {
    flushText(index);
    nodes.push(node);
    index += length;
    textStart = index;
  };

  while (index < source.length) {
    const rest = source.slice(index);
    const embed = /^@\[([^\]]+)\]\(([^\s)]+)\)/.exec(rest);
    if (embed) {
      const safeEmbed = parseSafeEmbed(embed[2] ?? '');
      if (safeEmbed) {
        add(
          {
            type: 'embed',
            label: embed[1] ?? safeEmbed.label,
            provider: safeEmbed.provider,
            url: safeEmbed.url,
          },
          embed[0].length,
        );
        continue;
      }
    }

    const image = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/.exec(rest);
    if (image) {
      const url = safeUrl(image[2] ?? '', false);
      if (url) {
        add(
          {
            type: 'image',
            url,
            alt: image[1] ?? '',
            ...(image[3] === undefined ? {} : { title: image[3] }),
          },
          image[0].length,
        );
        continue;
      }
    }

    const link = /^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/.exec(rest);
    if (link) {
      const url = safeUrl(link[2] ?? '', true);
      if (url) {
        add(
          {
            type: 'link',
            url,
            children: parseInline(link[1] ?? ''),
            ...(link[3] === undefined ? {} : { title: link[3] }),
          },
          link[0].length,
        );
        continue;
      }
    }

    const autolink = /^<((?:https?):\/\/[^\s>]+)>/i.exec(rest);
    if (autolink) {
      const url = safeUrl(autolink[1] ?? '', true);
      if (url) {
        add({ type: 'autolink', url }, autolink[0].length);
        continue;
      }
    }

    const code = /^(`+)([\s\S]*?)\1/.exec(rest);
    if (code) {
      add({ type: 'code', delimiter: code[1] ?? '`', value: code[2] ?? '' }, code[0].length);
      continue;
    }

    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (strong) {
      add(
        {
          type: 'strong',
          delimiter: strong[1] as '**' | '__',
          children: parseInline(strong[2] ?? ''),
        },
        strong[0].length,
      );
      continue;
    }

    const emphasis = /^(\*|_)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (
      emphasis &&
      !(
        emphasis[1] === '_' &&
        /\w/.test(source[index - 1] ?? '') &&
        /\w/.test(emphasis[0].slice(-2, -1))
      )
    ) {
      add(
        {
          type: 'emphasis',
          delimiter: emphasis[1] as '*' | '_',
          children: parseInline(emphasis[2] ?? ''),
        },
        emphasis[0].length,
      );
      continue;
    }

    index += 1;
  }
  flushText(source.length);
  return nodes;
}

function serializeInline(nodes: readonly MarkdownInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value;
        case 'strong':
          return `${node.delimiter}${serializeInline(node.children)}${node.delimiter}`;
        case 'emphasis':
          return `${node.delimiter}${serializeInline(node.children)}${node.delimiter}`;
        case 'code':
          return `${node.delimiter}${node.value}${node.delimiter}`;
        case 'link': {
          const url = safeUrl(node.url, true);
          if (!url) return serializeInline(node.children);
          const title = node.title === undefined ? '' : ` "${node.title.replaceAll('"', '\\"')}"`;
          return `[${serializeInline(node.children)}](${url}${title})`;
        }
        case 'image': {
          const url = safeUrl(node.url, false);
          if (!url) return node.alt;
          const title = node.title === undefined ? '' : ` "${node.title.replaceAll('"', '\\"')}"`;
          return `![${node.alt}](${url}${title})`;
        }
        case 'autolink':
          return `<${safeUrl(node.url, true) ?? node.url}>`;
        case 'embed':
          return `@[${node.label}](${node.url})`;
      }
    })
    .join('');
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  return Boolean(
    /^\s*(`{3,}|~{3,})/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*[-+*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\[\^[^\]]+\]:\s+/.test(line) ||
    /^\s*(?:---+|\*\s*\*\s*\*|___+)\s*$/.test(line) ||
    isTableStart(lines, index),
  );
}

/**
 * Resolve only known video hosts. The returned URL is safe to keep as a link
 * or provider card; callers never need to create an arbitrary iframe.
 */
export function parseSafeEmbed(raw: string): SafeEmbed | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port)
    return null;
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtube-nocookie.com' ||
    hostname === 'www.youtube-nocookie.com' ||
    hostname === 'youtu.be'
  ) {
    return { provider: 'youtube', label: 'YouTube', url: parsed.toString() };
  }
  if (hostname === 'vimeo.com' || hostname === 'www.vimeo.com' || hostname === 'player.vimeo.com') {
    return { provider: 'vimeo', label: 'Vimeo', url: parsed.toString() };
  }
  if (
    hostname === 'peertube.tv' ||
    hostname.endsWith('.peertube.tv') ||
    hostname === 'peertube.social' ||
    hostname.endsWith('.peertube.social') ||
    hostname === 'framatube.org' ||
    hostname.endsWith('.framatube.org') ||
    hostname === 'tube.tchncs.de'
  ) {
    return { provider: 'peertube', label: 'PeerTube', url: parsed.toString() };
  }
  return null;
}

export function renderSafeMarkdown(source: string, options: MarkdownRenderOptions = {}): string {
  return renderMarkdownSource(serializeMarkdown(parseMarkdown(source)), options);
}

function renderMarkdownSource(source: string, options: MarkdownRenderOptions = {}): string {
  const labels: MarkdownRenderLabels = { ...defaultRenderLabels, ...options.labels };
  const lines = normalizeMarkdown(source).split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^\s*(`{3,}|~{3,})([^`]*)$/.exec(line);
    if (fence) {
      const marker = fence[1] ?? '```';
      const language = sanitizeLanguage(fence[2] ?? '');
      const code: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !new RegExp(`^\\s*${escapeRegExp(marker.charAt(0))}{${marker.length},}\\s*$`).test(
          lines[index] ?? '',
        )
      ) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      const className = language ? ` class="language-${escapeAttr(language)}"` : '';
      blocks.push(`<pre><code${className}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      blocks.push(`<h${level}>${renderInline(heading[2] ?? '', labels)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|\*\s*\*\s*\*|___+)\s*$/.test(line)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = readTable(lines, index, labels);
      blocks.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote>${renderMarkdownSource(quote.join('\n'), { labels })}</blockquote>`);
      continue;
    }

    const unordered = /^\s*[-+*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? '';
        const match = (orderedList ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/).exec(current);
        if (!match) break;
        items.push(renderListItem(match[1] ?? '', labels));
        index += 1;
      }
      blocks.push(`<${orderedList ? 'ol' : 'ul'}>${items.join('')}</${orderedList ? 'ol' : 'ul'}>`);
      continue;
    }

    if (/^\[\^[^\]]+\]:\s+/.test(line)) {
      const footnote = /^\[\^([^\]]+)\]:\s+(.+)$/.exec(line);
      if (footnote) {
        blocks.push(
          `<p id="fn-${escapeAttr(footnote[1] ?? '')}><sup>${escapeHtml(footnote[1] ?? '')}</sup> ${renderInline(footnote[2] ?? '', labels)}</p>`,
        );
        index += 1;
        continue;
      }
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? '').trim()) {
      const next = lines[index] ?? '';
      if (
        /^\s*(?:`{3,}|~{3,})/.test(next) ||
        /^(#{1,6})\s+/.test(next) ||
        /^\s*>/.test(next) ||
        /^\s*[-+*]\s+/.test(next) ||
        /^\s*\d+[.)]\s+/.test(next)
      )
        break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join('\n'), labels).replace(/\n/g, '<br>')}</p>`);
  }

  return blocks.join('');
}

function renderListItem(source: string, labels: MarkdownRenderLabels): string {
  const task = /^\[([ xX])\]\s+(.+)$/.exec(source);
  if (!task) return `<li>${renderInline(source, labels)}</li>`;
  const checked = task[1]?.toLowerCase() === 'x';
  return `<li><input type="checkbox" disabled aria-label="${escapeAttr(checked ? labels.completedTask : labels.incompleteTask)}"${checked ? ' checked' : ''}> ${renderInline(task[2] ?? '', labels)}</li>`;
}

function isTableStart(lines: string[], index: number): boolean {
  return Boolean(
    lines[index]?.includes('|') &&
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? ''),
  );
}

function readTable(
  lines: string[],
  start: number,
  labels: MarkdownRenderLabels,
): { html: string; nextIndex: number } {
  const headers = splitTableRow(lines[start] ?? '');
  const separator = splitTableRow(lines[start + 1] ?? '');
  const alignments = separator.map((cell) => {
    const value = cell.trim();
    return value.startsWith(':') && value.endsWith(':')
      ? 'center'
      : value.startsWith(':')
        ? 'left'
        : value.endsWith(':')
          ? 'right'
          : '';
  });
  const head = headers
    .map(
      (cell) =>
        `<th${alignments[headers.indexOf(cell)] ? ` style="text-align:${alignments[headers.indexOf(cell)]}"` : ''}>${renderInline(cell, labels)}</th>`,
    )
    .join('');
  const rows: string[] = [];
  let index = start + 2;
  while (
    index < lines.length &&
    (lines[index] ?? '').includes('|') &&
    (lines[index] ?? '').trim()
  ) {
    const cells = splitTableRow(lines[index] ?? '');
    rows.push(
      `<tr>${cells.map((cell, cellIndex) => `<td${alignments[cellIndex] ? ` style="text-align:${alignments[cellIndex]}"` : ''}>${renderInline(cell, labels)}</td>`).join('')}</tr>`,
    );
    index += 1;
  }
  return {
    html: `<table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`,
    nextIndex: index,
  };
}

function splitTableRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function renderInline(source: string, labels: MarkdownRenderLabels): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);

    const embed = /^@\[([^\]]+)\]\(([^\s)]+)\)/.exec(rest);
    if (embed) {
      const safeEmbed = parseSafeEmbed(embed[2] ?? '');
      output += safeEmbed
        ? `<span data-embed-provider="${safeEmbed.provider}"><a href="${escapeAttr(safeEmbed.url)}" rel="nofollow noopener">${escapeHtml(labels.openEmbed(safeEmbed.label))}</a></span>`
        : escapeHtml(embed[0]);
      index += embed[0].length;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/.exec(rest);
    if (image) {
      const url = safeUrl(image[2] ?? '', false);
      if (url) {
        output += `<img src="${escapeAttr(url)}" alt="${escapeAttr(image[1] ?? '')}" loading="lazy" decoding="async">`;
      } else {
        output += escapeHtml(image[0]);
      }
      index += image[0].length;
      continue;
    }

    const link = /^\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/.exec(rest);
    if (link) {
      const url = safeUrl(link[2] ?? '', true);
      output += url
        ? `<a href="${escapeAttr(url)}" rel="nofollow noopener">${renderInline(link[1] ?? '', labels)}</a>`
        : escapeHtml(link[0]);
      index += link[0].length;
      continue;
    }

    const autolink = /^<((?:https?):\/\/[^\s>]+)>/i.exec(rest);
    if (autolink) {
      const url = safeUrl(autolink[1] ?? '', true);
      output += url
        ? `<a href="${escapeAttr(url)}" rel="nofollow noopener">${escapeHtml(url)}</a>`
        : escapeHtml(autolink[0]);
      index += autolink[0].length;
      continue;
    }

    const code = /^(`+)([\s\S]*?)\1/.exec(rest);
    if (code) {
      output += `<code>${escapeHtml((code[2] ?? '').trim())}</code>`;
      index += code[0].length;
      continue;
    }

    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (strong) {
      output += `<strong>${renderInline(strong[2] ?? '', labels)}</strong>`;
      index += strong[0].length;
      continue;
    }

    const emphasis = /^(\*|_)(?=\S)([\s\S]*?\S)\1/.exec(rest);
    if (
      emphasis &&
      !(
        emphasis[1] === '_' &&
        /\w/.test(source[index - 1] ?? '') &&
        /\w/.test(emphasis[0].slice(-2, -1))
      )
    ) {
      output += `<em>${renderInline(emphasis[2] ?? '', labels)}</em>`;
      index += emphasis[0].length;
      continue;
    }

    output += escapeHtml(source[index] ?? '');
    index += 1;
  }
  return output;
}

function safeUrl(raw: string, allowRelative: boolean): string | null {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  if (
    allowRelative &&
    ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#'))
  )
    return value;
  try {
    const parsed = new URL(value, 'https://oss.tips');
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (
      !allowRelative &&
      parsed.origin === 'https://oss.tips' &&
      !value.startsWith('http://') &&
      !value.startsWith('https://')
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

function sanitizeLanguage(value: string): string {
  const language = value.trim().split(/\s+/)[0] ?? '';
  return /^[a-zA-Z0-9_+-]{1,32}$/.test(language) ? language : '';
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
