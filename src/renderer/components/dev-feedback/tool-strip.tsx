// Drawing toolbar — shared by the on-screen overlay and the sketch pad.
//
// It uses no component from `components/ui`, on purpose: the moment this tool
// is wanted is the moment the screen is broken, and a toolbar built out of the
// thing under inspection goes down with it. Labels are icons rather than words
// because five word-buttons in a row overflow a narrow window.
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import { PALETTE, WIDTHS, type Tool } from './types';

const TOOLS: Array<{ tool: Tool; label: MessageKey; icon: React.ReactNode }> = [
  {
    tool: 'pen',
    label: 'devFeedback.tool.pen',
    icon: <path d="M3 13c3-1 4-8 7-8s2 7 5 7 3-4 3-4" />,
  },
  {
    tool: 'line',
    label: 'devFeedback.tool.line',
    icon: <path d="M4 16 16 4" />,
  },
  {
    tool: 'arrow',
    label: 'devFeedback.tool.arrow',
    icon: (
      <>
        <path d="M4 16 16 4" />
        <path d="M9 4h7v7" />
      </>
    ),
  },
  {
    tool: 'box',
    label: 'devFeedback.tool.box',
    icon: <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />,
  },
  {
    tool: 'eraser',
    label: 'devFeedback.tool.eraser',
    icon: (
      <>
        <path d="M9 15h7" />
        <path d="m4.5 12.5 5-5a1.5 1.5 0 0 1 2.2 0l2.8 2.8a1.5 1.5 0 0 1 0 2.2l-2.5 2.5H7.5z" />
      </>
    ),
  },
];

export function ToolStrip({
  tool,
  onTool,
  color,
  onColor,
  width,
  onWidth,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: string;
  onColor: (c: string) => void;
  width: number;
  onWidth: (w: number) => void;
}) {
  const t = useT();

  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-1 gap-y-1 rounded-full border border-border bg-card/95 px-1.5 py-1 text-card-foreground shadow-lg backdrop-blur-sm">
      {TOOLS.map((item) => {
        const on = tool === item.tool;
        return (
          <button
            key={item.tool}
            type="button"
            aria-label={t(item.label)}
            aria-pressed={on}
            title={t(item.label)}
            onClick={() => onTool(item.tool)}
            className="grid size-7 place-items-center rounded-md"
            // The active tool takes on the current colour — tool and colour
            // read as one state instead of two.
            style={on ? { background: color, color: '#fff' } : undefined}
          >
            <svg
              viewBox="0 0 20 20"
              className="size-[17px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {item.icon}
            </svg>
          </button>
        );
      })}

      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />

      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={t('devFeedback.color', { value: c })}
          aria-pressed={color === c}
          onClick={() => {
            onColor(c);
            // Picking a colour means "I am about to draw". Staying on the
            // eraser would make the next gesture do nothing.
            if (tool === 'eraser') onTool('pen');
          }}
          className="grid size-6 place-items-center rounded-full"
        >
          <span
            className="block rounded-full"
            style={{
              background: c,
              width: color === c ? 16 : 12,
              height: color === c ? 16 : 12,
              boxShadow: color === c ? '0 0 0 2px rgba(255,255,255,.9), 0 0 0 3.5px currentColor' : undefined,
            }}
          />
        </button>
      ))}

      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />

      {WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          aria-label={t('devFeedback.width', { value: w })}
          aria-pressed={width === w}
          onClick={() => onWidth(w)}
          className="grid size-6 place-items-center rounded-md"
          style={width === w ? { background: 'rgba(127,127,127,.22)' } : undefined}
        >
          <span className="block w-4 rounded-full" style={{ background: color, height: w }} />
        </button>
      ))}
    </div>
  );
}
