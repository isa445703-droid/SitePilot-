import type { ReactNode } from "react";

/**
 * Safe Markdown renderer.
 *
 * The AI never outputs executable code: this parser produces React elements
 * only (no `dangerouslySetInnerHTML`, no raw HTML passthrough), and links or
 * image sources that are not http(s)/relative are dropped.
 */

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:)/i;

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  return SAFE_URL.test(trimmed) ? trimmed : null;
}

const INLINE_PATTERN =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))|(!\[[^\]]*\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;
  let index = 0;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("!")) {
      const [, alt, src] = token.match(/!\[([^\]]*)\]\(([^)\s]+)\)/) ?? [];
      const url = safeHref(src ?? "");
      nodes.push(
        url ? (
          // Markdown images point at arbitrary author URLs; next/image would
          // require a remote pattern allowlist for every generated site.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={key} src={url} alt={alt ?? ""} loading="lazy" />
        ) : (
          <span key={key}>{alt}</span>
        ),
      );
    } else {
      const [, label, href] = token.match(/\[([^\]]+)\]\(([^)\s]+)\)/) ?? [];
      const url = safeHref(href ?? "");
      nodes.push(
        url ? (
          <a key={key} href={url} rel="noopener noreferrer nofollow ugc" target="_blank">
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function isTableLine(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Parses Markdown into React elements. Never executes or injects HTML. */
export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const push = (node: ReactNode) => {
    blocks.push(node);
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (/^\s*```/.test(line)) {
      const buffer: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buffer.push(lines[i]);
        i++;
      }
      i++;
      push(<pre key={`code-${key++}`}><code>{buffer.join("\n")}</code></pre>);
      continue;
    }

    // Blank
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      // The page title is already the h1, so markdown `#` becomes an h2.
      const tags = ["h2", "h3", "h4", "h5", "h6"] as const;
      const Tag = tags[Math.min(heading[1].length - 1, tags.length - 1)];
      push(<Tag key={`h-${key++}`}>{renderInline(heading[2], `h${key}`)}</Tag>);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      push(<hr key={`hr-${key++}`} />);
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buffer.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      push(
        <blockquote key={`q-${key++}`}>
          <Markdown content={buffer.join("\n")} />
        </blockquote>,
      );
      continue;
    }

    // Table
    if (isTableLine(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      push(
        <table key={`table-${key++}`}>
          <thead>
            <tr>
              {header.map((cell, cellIndex) => (
                <th key={cellIndex}>{renderInline(cell, `th${cellIndex}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInline(cell, `td${rowIndex}-${cellIndex}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      push(
        <ul key={`ul-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `li${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      push(
        <ol key={`ol-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `oli${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph (until blank line or another block start)
    const buffer: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|(-{3,}|\*{3,}|_{3,})\s*$)/.test(lines[i]) &&
      !isTableLine(lines[i])
    ) {
      buffer.push(lines[i].trim());
      i++;
    }
    if (buffer.length > 0) {
      push(<p key={`p-${key++}`}>{renderInline(buffer.join(" "), `p${key}`)}</p>);
    } else {
      i++;
    }
  }

  return <div className={className}>{blocks}</div>;
}
