import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

/**
 * A workspace `.md` file, read as a document.
 *
 * The workbench ships its guide beside the scripts — `GUIDE_ko.md` and
 * `GUIDE_en.md` — and the file list opens them in the same editor as everything
 * else, so the files on that list written to be *read* arrive as `|---|---|`.
 * Prose is not read that way.
 *
 * No typography plugin: every element is dressed here out of the design tokens,
 * so the document wears this app's palette in both themes instead of a
 * plugin's own. GFM is on for one reason — the guide is mostly a table.
 */

// Links leave the app. `setWindowOpenHandler` in main answers `target="_blank"`
// with `shell.openExternal` and denies the navigation, so the renderer never
// walks off its own page.
const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 text-xl font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 border-b border-border pb-1 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold tracking-tight first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-6 text-sm font-semibold tracking-tight first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mt-4 break-keep leading-7 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-1 pl-6 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1 pl-6 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="break-keep leading-7">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-border pl-4 text-muted-foreground first:mt-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  // A wide table scrolls inside its own box rather than pushing the column out.
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto first:mt-0">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5 align-top">{children}</td>
  ),
  // `code` dresses the inline span. Inside a fenced block the same element is
  // the block's body, so `pre` undoes the chip there — react-markdown stopped
  // telling the two apart with a prop, and a fence with no language carries no
  // class to test either.
  code: ({ children }) => (
    <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed first:mt-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-[1em]">
      {children}
    </pre>
  ),
};

interface Props {
  source: string;
  /** Marks the reading pane so tests and the surface adapter can find it. */
  testId?: string;
}

export function MarkdownView({ source, testId }: Props) {
  return (
    <div data-testid={testId} className="h-full overflow-auto px-6 py-5">
      {/* A reading measure, not the full panel width — the panel is as wide as
          the screen and a 200-character line is read twice. */}
      <div className="mx-auto max-w-3xl text-sm text-foreground">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {source}
        </Markdown>
      </div>
    </div>
  );
}
