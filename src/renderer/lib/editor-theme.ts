import { tokenHex } from './token-color';

/**
 * The Monaco editor ships its own `vs` / `vs-dark` themes. Left alone it looks
 * like a different product dropped into the middle of the app, and its default
 * comment colour misses 4.5:1 on our field.
 *
 * So the theme is built from the same tokens as everything else. Monaco will
 * not take a CSS variable, hence `tokenHex` — the values still originate in
 * `global.css`, they are just resolved at call time.
 *
 * Syntax colours reuse the chart palette (`--c1`..`--c6`). Those six are
 * already a set of mutually distinguishable hues checked for contrast in both
 * themes, which is exactly what syntax highlighting needs.
 */

/** Minimal shape of the Monaco namespace this module touches. */
export interface MonacoThemeHost {
  editor: {
    defineTheme(name: string, theme: unknown): void;
    setTheme(name: string): void;
  };
}

export const EDITOR_THEME_NAME = 'hermetra';

/** `#rrggbb` for Monaco's `rules`, which take the hex without its hash. */
const bare = (hex: string) => hex.replace('#', '');

export function buildEditorTheme(isDark: boolean, root?: Element) {
  const t = (name: string) => tokenHex(name, root ?? document.documentElement);

  const fg = t('card-foreground');
  const muted = t('muted-foreground');
  const card = t('card');

  return {
    base: isDark ? 'vs-dark' : 'vs',
    // Inherit Monaco's rules for the token types we do not name, so an
    // unstyled language still highlights instead of going flat.
    inherit: true,
    rules: [
      { token: '', foreground: bare(fg), background: bare(card) },
      { token: 'comment', foreground: bare(muted), fontStyle: 'italic' },
      { token: 'string', foreground: bare(t('c1')) },
      { token: 'keyword', foreground: bare(t('c2')) },
      { token: 'type', foreground: bare(t('c2')) },
      { token: 'number', foreground: bare(t('c4')) },
      { token: 'regexp', foreground: bare(t('c5')) },
      { token: 'delimiter', foreground: bare(muted) },
      { token: 'invalid', foreground: bare(t('c6')) },
    ],
    colors: {
      'editor.background': card,
      'editor.foreground': fg,
      // Editors traditionally dim the gutter almost to nothing. `--placeholder`
      // is that shade and it lands at 2.7:1 — below the 4.5:1 this project
      // holds itself to, so the gutter gets the readable muted tone instead.
      'editorLineNumber.foreground': muted,
      'editorLineNumber.activeForeground': fg,
      'editor.lineHighlightBackground': t('muted'),
      'editor.selectionBackground': t('accent'),
      'editorCursor.foreground': t('primary'),
      'editorIndentGuide.background': t('border'),
      'editorIndentGuide.activeBackground': t('input'),
      'editorWidget.background': card,
      'editorWidget.border': t('border'),
      'editorSuggestWidget.background': card,
      'editorSuggestWidget.border': t('border'),
      'input.background': t('muted'),
      'input.foreground': fg,
      'scrollbarSlider.background': t('border'),
      // Bracket pair colours are their own setting — the syntax rules above do
      // not reach them, and Monaco's defaults miss 4.5:1 on a white card.
      // Nesting depth is a real editing aid, so recolour rather than disable.
      'editorBracketHighlight.foreground1': t('c2'),
      'editorBracketHighlight.foreground2': t('c4'),
      'editorBracketHighlight.foreground3': t('c5'),
      'editorBracketHighlight.foreground4': t('c1'),
      'editorBracketHighlight.foreground5': t('c2'),
      'editorBracketHighlight.foreground6': t('c4'),
      'editorBracketHighlight.unexpectedBracket.foreground': t('c6'),
    },
  };
}

/** Define and select the theme. Safe to call again after a theme switch. */
export function applyEditorTheme(monaco: MonacoThemeHost, isDark: boolean, root?: Element): void {
  monaco.editor.defineTheme(EDITOR_THEME_NAME, buildEditorTheme(isDark, root));
  monaco.editor.setTheme(EDITOR_THEME_NAME);
}
