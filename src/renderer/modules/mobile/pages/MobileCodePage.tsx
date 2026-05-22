import { useEffect, useState } from 'react';
import { useMobileStore } from '../store';
import { CodeEditor } from '@/modules/shared/CodeEditor';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';

const DEFAULT_SCRIPT = `// driver : WebdriverIO 인스턴스 (Appium 세션)
// env    : process env
// bus    : 공유 버스 (get / set)
// log()  : 출력 패널에 메시지 기록

const otp = await driver.$('~otpInput');
await otp.setValue('123456');
const submit = await driver.$('~verifyButton');
await submit.click();
log('verify button tapped');
`;

export function MobileCodePage() {
  const t = useT();
  const {
    appium,
    activeCapabilityId,
    capabilities,
    session,
    scripts,
    currentScript,
    output,
    listScripts,
    loadScript,
    saveScript,
    deleteScript,
    mkdirScript,
    moveScripts,
    setCurrentScript,
    runScript,
  } = useMobileStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listScripts();
  }, [listScripts]);

  const cap = capabilities.find((c) => c.id === activeCapabilityId);
  const ready = appium.isRunning && !!cap && session.active;

  return (
    <CodeEditor
      accent="mobile"
      testId="page-mobile-code"
      titleKey="mobile.code.title"
      subtitleKey="mobile.code.subtitle"
      scripts={scripts}
      current={currentScript}
      output={output}
      readyLabel={t('common.ready')}
      notReadyLabel={t('common.notReady')}
      ready={ready}
      busy={busy}
      defaultSeed={DEFAULT_SCRIPT}
      rightHeader={
        <Badge variant="outline" className="text-[10px]">
          {t('mobile.code.activeCap')}: {cap?.name ?? t('mobile.code.noCap')}
        </Badge>
      }
      onLoad={loadScript}
      onSave={saveScript}
      onDelete={deleteScript}
      onMkdir={mkdirScript}
      onMove={moveScripts}
      onSelectNew={setCurrentScript}
      onRun={async (source) => {
        setBusy(true);
        try {
          await runScript(source);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
