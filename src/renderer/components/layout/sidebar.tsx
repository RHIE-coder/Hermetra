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
  accent: 'web' | 'mobile' | 'bridge';
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    titleKey: 'sidebar.group.web',
    accent: 'web',
    items: [
      { to: '/web/remote', labelKey: 'sidebar.web.remote', icon: Globe, testId: 'nav-web-remote' },
      { to: '/web/code', labelKey: 'sidebar.web.code', icon: Terminal, testId: 'nav-web-code' },
    ],
  },
  {
    titleKey: 'sidebar.group.mobile',
    accent: 'mobile',
    items: [
      { to: '/mobile/devices', labelKey: 'sidebar.mobile.devices', icon: Smartphone, testId: 'nav-mobile-devices' },
      { to: '/mobile/code', labelKey: 'sidebar.mobile.code', icon: Terminal, testId: 'nav-mobile-code' },
      { to: '/mobile/inspector', labelKey: 'sidebar.mobile.inspector', icon: Crosshair, testId: 'nav-mobile-inspector' },
    ],
  },
  {
    titleKey: 'sidebar.group.bridge',
    accent: 'bridge',
    items: [
      { to: '/bridge/scenarios', labelKey: 'sidebar.bridge.scenarios', icon: Workflow, testId: 'nav-bridge-scenarios' },
      { to: '/bridge/variables', labelKey: 'sidebar.bridge.variables', icon: Sliders, testId: 'nav-bridge-variables' },
      { to: '/bridge/bus', labelKey: 'sidebar.bridge.bus', icon: Cable, testId: 'nav-bridge-bus' },
      { to: '/bridge/events', labelKey: 'sidebar.bridge.events', icon: Activity, testId: 'nav-bridge-events' },
    ],
  },
];

export function Sidebar() {
  const t = useT();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card/40">
      <div className="flex h-14 items-center gap-2 px-5 border-b border-border">
        <HermetraMark className="h-8 w-8" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">{t('titlebar.brand')}</span>
          <span className="text-[10px] text-muted-foreground">{t('sidebar.tagline')}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {groups.map((group) => (
          <div key={group.titleKey}>
            <div className="flex items-center gap-2 px-2 mb-2">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  group.accent === 'web' && 'bg-web',
                  group.accent === 'mobile' && 'bg-mobile',
                  group.accent === 'bridge' && 'bg-bridge',
                )}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t(group.titleKey)}
              </span>
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    data-testid={item.testId}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors',
                        'hover:bg-accent hover:text-foreground',
                        isActive && 'bg-accent text-foreground font-medium',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3 text-[10px] text-muted-foreground">
        {t('sidebar.footer')}
      </div>
    </aside>
  );
}
