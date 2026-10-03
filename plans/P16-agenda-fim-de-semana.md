# P16: Sábado e domingo nos zooms 3 dias e Dia

O zoom Semana segue de segunda a sexta. O 3 dias começa no dia escolhido e encosta no domingo
(sexta, sábado e domingo mostram os três); o Dia mostra o próprio dia. A semana da agenda passa a
ir até o domingo, que aceita lançamento e arrasto.

- [x] T1. `semanas.ts`: `diasDaSemana` de segunda a domingo; `rotuloSemana` até o domingo
- [x] T2. `agenda.ts`: mensagens "de segunda a domingo" (a validação já usa `diasDaSemana`)
- [x] T3. `agenda-zoom.ts`: janela que começa no dia; setas de 1 dia no Dia e de janela em janela no 3 dias; sai `proximoDiaUtil`
- [x] T4. `AgendaDaSemana.tsx`: a grade recebe os 7 dias; `ForaDaGrade.tsx` só no zoom Semana; celular mostra sábado e domingo com tarefa
- [x] T5. Testes e `npm test`
