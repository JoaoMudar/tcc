---
name: escrita-tcc
description: Regras duras de escrita da prosa em português deste repositório. Use ao redigir, reescrever, expandir, encurtar ou revisar qualquer texto corrido de docs/ e dos capítulos do TCC. Não use para código, mensagens de commit nem respostas de chat.
---

# Escrita do TCC

Só regras verificáveis. Nada de conselho de estilo.

## Regras duras

- **Nunca use travessão (—).** Use vírgula, ponto, parênteses ou, com parcimônia, dois-pontos.
- **No máximo um dois-pontos por parágrafo, e nunca em frases seguidas.** O sinal anuncia que o
  que vem depois explica o que veio antes, e repetido a cada frase ele deixa de anunciar coisa
  alguma: vira tique, e todo parágrafo passa a ter a mesma forma. Na segunda vez, escolha outra
  saída, ponto final e frase nova, "porque", "e é por isso que", ou vírgula.
- **Nunca fale do viveiro diretamente.** Escreva sempre "um viveiro de mudas": nunca o nome da
  empresa, nunca o nome das pessoas, nunca "o viveiro" como se o leitor soubesse qual é. O caso é um
  exemplo, e o texto o trata como exemplo.
- **Sem emoji.**
- **Negrito só na afirmação**, nunca espalhado em palavras soltas para dar aparência de ênfase. Um
  negrito por parágrafo, e ele carrega a tese.
- **Número que se sabe, se escreve.** "Três perfis", "54 regras", "seis colaboradores". Nunca
  "diversos", "vários" ou "alguns" quando o número está no repositório.
- **Data absoluta**, no formato dd/mm/aaaa. Nunca "recentemente", "hoje" ou "na semana passada".
- **Vocabulário do domínio**: lote, canteiro, recipiente, muda, turno, repicagem, saldo, leva. Não
  invente sinônimo para termo do domínio nem traduza para vocabulário de software.
- **Nunca escreva em `docs/engenharia/word/`.** A pasta é gerada e apagada por
  `node scripts/build-word.mjs`. Edite a origem.
- **Enunciado se copia da origem, não da memória.** RF, RNF, RN, UC e CT vêm do `B2`, `B3`, `C2` ou
  `E2`. Parafrasear de memória é a origem mais comum de divergência.
- Se o texto cita identificador (RF, RNF, RN, UC, CT, PR, RE, CS, OP), rode
  `node scripts/verifica-rastreabilidade.mjs` depois.
