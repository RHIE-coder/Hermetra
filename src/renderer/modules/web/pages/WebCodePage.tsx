import { useEffect, useState } from 'react';
import { useWebStore } from '../store';
import { CodeEditor } from '@/modules/shared/CodeEditor';
import { useT } from '@/lib/i18n';

const DEFAULT_SCRIPT = `// page  : 활성 Playwright 페이지
// env   : process env
// bus   : 공유 버스 (get / set)
// log() : 출력 패널에 메시지 기록

await page.goto('https://example.com');
log('title:', await page.title());
`;

export function WebCodePage() {
  const t = useT();
  const {
    status,
    output,
    scripts,
    currentScript,
    listScripts,
    loadScript,
    saveScript,
    deleteScript,
    mkdirScript,
    setCurrentScript,
    runScript,
  } = useWebStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listScripts();
  }, [listScripts]);

  return (
    <CodeEditor
      accent="web"
      titleKey="web.code.title"
      subtitleKey="web.code.subtitle"
      scripts={scripts}
      current={currentScript}
      output={output}
      readyLabel={t('web.code.browserReady')}
      notReadyLabel={t('web.code.browserIdle')}
      ready={status.isRunning}
      busy={busy}
      defaultSeed={DEFAULT_SCRIPT}
      onLoad={loadScript}
      onSave={saveScript}
      onDelete={deleteScript}
      onMkdir={mkdirScript}
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
