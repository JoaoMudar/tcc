# P15: Zoom da agenda da semana e tarefas sem cor no dev

Zoom Semana · 3 dias · Dia ao lado de "Hoje", com `Ctrl + roda` sobre a grade; as setas andam no
passo do zoom. E o bug das tarefas sem cor no localhost: o service worker de um `next start`
antigo continuava servindo o CSS do cache no `next dev`.

- [x] T1. `RegistraServiceWorker`: no dev, remove o service worker e o cache e recarrega uma vez
- [x] T2. `src/lib/agenda-zoom.ts`: janela de dias, passo das setas, zoom vizinho; `proximoDiaUtil` em `datas.ts`
- [x] T3. `ZoomAgenda.tsx` (contexto + cookie), `SeletorZoom.tsx`, `NavegacaoAgenda.tsx`
- [x] T4. `AgendaDaSemana.tsx`: lê o cookie, usa a navegação e o seletor
- [x] T5. `GanttSemana.tsx`: desenha a janela do zoom, `Ctrl + roda`, atalhos ← → no passo do zoom
- [x] T6. Testes e `npm test`
