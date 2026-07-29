import { NavLink } from 'react-router-dom';
import {
  Globe,
  Smartphone,
  Workflow,
  Activity,
  Terminal,
  Sliders,
  Cable,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import { HermetraMark } from '@/components/brand/hermetra-mark';

interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

interface NavGroup {
  titleKey: MessageKey;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    titleKey: 'sidebar.group.web',
    items: [
      { to: '/web/remote', labelKey: 'sidebar.web.remote', icon: Globe, testId: 'nav-web-remote' },
      { to: '/web/code', labelKey: 'sidebar.web.code', icon: Terminal, testId: 'nav-web-code' },
    ],
  },
  {
    titleKey: 'sidebar.group.mobile',
    items: [
      { to: '/mobile/devices', labelKey: 'sidebar.mobile.devices', icon: Smartphone, testId: 'nav-mobile-devices' },
      { to: '/mobile/code', labelKey: 'sidebar.mobile.code', icon: Terminal, testId: 'nav-mobile-code' },
      { to: '/mobile/inspector', labelKey: 'sidebar.mobile.inspector', icon: Crosshair, testId: 'nav-mobile-inspector' },
    ],
  },
  {
    titleKey: 'sidebar.group.bridge',
    items: [
      { to: '/bridge/scenarios', labelKey: 'sidebar.bridge.scenarios', icon: Workflow, testId: 'nav-bridge-scenarios' },
      { to: '/bridge/variables', labelKey: 'sidebar.bridge.variables', icon: Sliders, testId: 'nav-bridge-variables' },
      { to: '/bridge/bus', labelKey: 'sidebar.bridge.bus', icon: Cable, testId: 'nav-bridge-bus' },
      { to: '/bridge/events', labelKey: 'sidebar.bridge.events', icon: Activity, testId: 'nav-bridge-events' },
    ],
  },
];

/**
 * The rail is the darkest surface in the app; each group is a card lifted out
 * of it. Nothing here is tinted — the sidebar used to mark its groups and its
 * selected row with module accents, and an accent on a card is exactly what
 * this product's design forbids.
 *
 * Selection therefore reads by depth, not colour: the chosen row is pressed
 * into its card (darker fill, inset shadow) while every other row is flush.
 * That keeps the highlight inside the list's own grid instead of floating a
 * coloured box out of it, and it survives being seen in greyscale.
 *
 * The group title gets its own full-bleed band for the same reason. It used to
 * be 10px muted text floating on the card — the weakest thing in the card that
 * names it. Uppercase + wide tracking only lifts a Latin label, and these
 * labels are "웹 / 모바일 / 브리지" in Korean, so the emphasis has to come from
 * surface and contrast instead: a `muted` strip (darker than the card in both
 * themes) divided off by a hairline, with the label at full foreground weight.
 */
export function Sidebar() {
  const t = useT();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar">
      {/* Mark plus wordmark, one line — no tagline. "Web / Mobile automation
          bridge" is a landing-page line: true on first launch, dead pixels
          every launch after. The one thing that does change here, the active
          workspace, already has a home in the topbar, so this stays a
          nameplate and gives its vertical space back to the nav. */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-3.5">
        <HermetraMark className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight">{t('titlebar.brand')}</span>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-2">
        {groups.map((group) => (
          <section key={group.titleKey} className="overflow-hidden rounded-lg bg-card shadow">
            <h2 className="border-b border-border bg-muted px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
              {t(group.titleKey)}
            </h2>
            <ul className="space-y-0.5 p-1.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    data-testid={item.testId}
                    className={({ isActive }) =>
                      cn(
                        'flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors',
                        'hover:bg-accent hover:text-foreground',
                        isActive && 'bg-muted font-semibold text-foreground shadow-inner',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="border-t border-border p-2.5 text-[10px] text-muted-foreground">
        {t('sidebar.footer')}
      </div>
    </aside>
  );
}
