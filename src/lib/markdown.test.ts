import { renderMarkdownToHtml } from "@/lib/markdown";

describe("renderMarkdownToHtml", () => {
  it("returns an empty string for empty markdown", () => {
    expect(renderMarkdownToHtml("")).toBe("");
    expect(renderMarkdownToHtml("   \n  ")).toBe("");
  });

  it("renders headings, paragraphs, emphasis, and strikethrough", () => {
    const html = renderMarkdownToHtml(
      "# Heading\n\nHello **World** and *friends* with ~~old~~ text.",
    );

    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain(
      "<p>Hello <strong>World</strong> and <em>friends</em> with <del>old</del> text.</p>",
    );
  });

  it("renders unordered lists, ordered lists, hr and blockquote", () => {
    const html = renderMarkdownToHtml(
      "- item one\n- item two\n\n1. first\n2. second\n\n---\n\n> quote line",
    );

    expect(html).toContain("<ul><li>item one</li><li>item two</li></ul>");
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain("<hr />");
    expect(html).toContain("<blockquote><p>quote line</p></blockquote>");
  });

  it("renders fenced code blocks and inline code", () => {
    const html = renderMarkdownToHtml(
      "```ts\nconst x = 1;\n```\n\nUse `npm run build` now.",
    );

    expect(html).toContain(
      '<pre><code class="language-ts">const x = 1;</code></pre>',
    );
    expect(html).toContain("<code>npm run build</code>");
  });

  it("sanitizes raw html and unsafe links", () => {
    const html = renderMarkdownToHtml(
      "<script>alert(1)</script>\n\n[Bad](javascript:alert(1)) [Good](https://example.com)",
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("javascript:alert");
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Good</a>',
    );
  });

  it("allows safe protocols and anchor links", () => {
    const html = renderMarkdownToHtml(
      "[Mail](mailto:test@example.com) [Tel](tel:+12345) [Hash](#section)",
    );

    expect(html).toContain('href="mailto:test@example.com"');
    expect(html).toContain('href="tel:+12345"');
    expect(html).toContain('href="#section"');
  });

  it("handles list type transitions and invalid/empty urls", () => {
    const html = renderMarkdownToHtml(
      "1. first\n- second\n\n- third\n1. fourth\n\n[Empty](   ) [Broken](http://[::1)",
    );

    expect(html).toContain("<ol><li>first</li></ol>");
    expect(html).toContain("<ul><li>second</li></ul>");
    expect(html).toContain("<ul><li>third</li></ul>");
    expect(html).toContain("<ol><li>fourth</li></ol>");
    expect(html).toContain("Empty");
    expect(html).toContain("Broken");
    expect(html).not.toContain('href="http://[::1"');
  });

  it("handles defensive token fallbacks and empty blockquote body", () => {
    const html = renderMarkdownToHtml(
      [
        "@@SOLSTACKINLINECODETOKEN99@@",
        "@@SOLSTACK_CODE_BLOCK_99@@",
        ">",
        "```",
        "plain",
        "```",
      ].join("\n"),
    );

    expect(html).toContain("<p></p>");
    expect(html).toContain("<blockquote><p></p></blockquote>");
    expect(html).toContain("<pre><code>plain</code></pre>");
    expect(html).not.toContain("SOLSTACKINLINECODETOKEN99");
  });
});
