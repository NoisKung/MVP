const CODE_BLOCK_TOKEN_PREFIX = "@@SOLSTACK_CODE_BLOCK_";
const INLINE_CODE_TOKEN_PREFIX = "@@SOLSTACK_INLINE_CODE_";
const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(rawUrl: string): string | null {
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) return null;

  if (trimmedUrl.startsWith("#")) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl, "https://solostack.local");
    if (ALLOWED_LINK_PROTOCOLS.has(parsedUrl.protocol)) {
      return trimmedUrl;
    }
  } catch {
    return null;
  }

  return null;
}

function applyInlineMarkdown(escapedContent: string): string {
  const inlineCodeBlocks: string[] = [];

  const withInlineCodeTokens = escapedContent.replace(
    /`([^`\n]+)`/g,
    (_match, codeValue: string) => {
      const token = `${INLINE_CODE_TOKEN_PREFIX}${inlineCodeBlocks.length}@@`;
      inlineCodeBlocks.push(`<code>${codeValue}</code>`);
      return token;
    },
  );

  const withLinks = withInlineCodeTokens.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, hrefValue: string) => {
      const safeHref = sanitizeUrl(hrefValue);
      if (!safeHref) return label;
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    },
  );

  const withBoldText = withLinks
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>");

  const withItalicText = withBoldText
    .replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?=[^_]|$)/g, "$1<em>$2</em>");

  const withStrikethrough = withItalicText.replace(
    /~~([^~]+)~~/g,
    "<del>$1</del>",
  );

  return withStrikethrough.replace(
    /@@SOLSTACK_INLINE_CODE_(\d+)@@/g,
    (_match, indexValue: string) =>
      inlineCodeBlocks[Number(indexValue)] ?? "",
  );
}

function renderLinesToHtml(escapedMarkdown: string, codeBlocks: string[]): string {
  const htmlParts: string[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];
  let activeListType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    htmlParts.push(
      `<p>${paragraphLines.map((line) => applyInlineMarkdown(line)).join("<br />")}</p>`,
    );
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!activeListType || listItems.length === 0) return;

    const listHtml = listItems
      .map((item) => `<li>${applyInlineMarkdown(item)}</li>`)
      .join("");
    htmlParts.push(`<${activeListType}>${listHtml}</${activeListType}>`);
    listItems.length = 0;
    activeListType = null;
  };

  const lines = escapedMarkdown.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    const codeBlockMatch = trimmedLine.match(/^@@SOLSTACK_CODE_BLOCK_(\d+)@@$/);
    if (codeBlockMatch) {
      flushParagraph();
      flushList();
      htmlParts.push(codeBlocks[Number(codeBlockMatch[1])] ?? "");
      continue;
    }

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const headingLevel = headingMatch[1].length;
      htmlParts.push(
        `<h${headingLevel}>${applyInlineMarkdown(headingMatch[2])}</h${headingLevel}>`,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      flushParagraph();
      flushList();
      htmlParts.push("<hr />");
      continue;
    }

    const unorderedListMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    if (unorderedListMatch) {
      flushParagraph();
      if (activeListType === "ol") {
        flushList();
      }
      activeListType = "ul";
      listItems.push(unorderedListMatch[1]);
      continue;
    }

    const orderedListMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      flushParagraph();
      if (activeListType === "ul") {
        flushList();
      }
      activeListType = "ol";
      listItems.push(orderedListMatch[1]);
      continue;
    }

    const blockquoteMatch = trimmedLine.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      htmlParts.push(
        `<blockquote><p>${applyInlineMarkdown(blockquoteMatch[1] || "")}</p></blockquote>`,
      );
      continue;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  flushList();

  return htmlParts.join("\n");
}

/** Render user markdown to safe HTML for read-only previews */
export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) {
    return "";
  }

  const escapedMarkdown = escapeHtml(markdown.replace(/\r\n/g, "\n"));
  const codeBlocks: string[] = [];

  const withCodeBlockTokens = escapedMarkdown.replace(
    /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g,
    (_match, language: string | undefined, codeContent: string) => {
      const token = `${CODE_BLOCK_TOKEN_PREFIX}${codeBlocks.length}@@`;
      const languageClass = language?.trim()
        ? ` class="language-${language.trim()}"`
        : "";
      codeBlocks.push(
        `<pre><code${languageClass}>${codeContent.trimEnd()}</code></pre>`,
      );
      return `\n${token}\n`;
    },
  );

  return renderLinesToHtml(withCodeBlockTokens, codeBlocks);
}
