# Resposta aos apontamentos da orientação de 15/09/2026

Um bloco por apontamento. O catálogo de regras passou de 54 para 52 e foi renumerado, então os
identificadores novos aparecem ao lado dos antigos.

## Regras de negócio

**RN-08 diz que o estoque é formado por espécie, mas RN-04 diz que o produto é espécie com
recipiente.**
Corrigido. RN-08 agora diz: "A quantidade disponível do produto é a soma dos lotes abertos daquela
espécie e recipiente". RN-04 ficou como estava.

**RN-11: transformar os 20% em parâmetro.**
Já é parâmetro, em Configurações, desde a primeira versão do banco. O enunciado é que cravava o
número, e foi reescrito para "acima do limite definido em Configurações". Os seis pontos em prosa
que repetiam 20% também foram corrigidos.

**RN-23: "como plantio, manutenção e expedição" não informa as seis categorias.**
A regra saiu do catálogo. Classificar tarefa em categoria não impõe nada ao viveiro: não muda
formulário, não restringe operação e não altera cálculo. A lista fechada das seis continua, em
RF-21 e no banco.

**RN-30: não entendi.**
Saiu do catálogo. Dizia que a situação do lote é calculada e nunca digitada, o que é decisão de
projeto e não regra do negócio. O comportamento continua, em RF-45.

**RN-05 e RN-32 parecem a mesma regra.**
São distintas, e a redação de RN-05 é que confundia. RN-32 (hoje RN-30) diz de quem é o protocolo,
e a resposta é do recipiente. RN-05 diz que a produção segue uma sequência declarada de etapas com
prazo. RN-05 foi reescrita, porque mencionava a espécie sem precisar.

**RN-43: precisa melhorar a redação.**
Reescrita (hoje RN-41): "O protocolo sugere tarefas de acordo com a necessidade do lote". O detalhe
de como a sugestão vira tarefa passou para RF-47, que é o lugar dele.

## Requisitos funcionais

**RF-01 fala de autenticação, mas está ligado a RN-53 e RN-54.**
O apontamento está certo, e os dois vínculos foram desfeitos. RF-01 é autenticação, RN-51 (antiga
RN-53) é autorização e RN-52 (antiga RN-54) é autoria. RF-01 passou para a lista de requisitos sem
regra de negócio.

**RF-07 e RF-25: trocar "deveria" por "deve".**
Trocado. Eram os dois únicos enunciados em 58 escritos assim. A prioridade continua marcada na
coluna MoSCoW.

## O documento no Word

**A numeração salta de 4.3 para 3.5.**
Era defeito do gerador, que copiava os subtítulos de cada artefato sem subordiná-los à seção.
Corrigido no gerador, e valia para as dez seções.

**Elementos pré-textuais.**
Escritos: dedicatória, agradecimentos e epígrafe. Os nomes próprios ficaram entre colchetes e
precisam ser preenchidos.

**Quebras de página e a página 16 em branco.**
O procedimento foi escrito no guia de montagem. A causa provável da página em branco é quebra de
página inserida onde já havia quebra de seção.

## O que não foi feito

**Referências mais recentes.**
Ficou para a próxima rodada. Um ponto vale adiantar: os cinco atributos de usabilidade que o plano
de testes usa vêm de Nielsen (1993) e não existem naquela forma na obra recente do mesmo autor.
Trocar a fonte descaracterizaria o instrumento; o caminho seria manter a de 1993 e acrescentar um
autor recente ao lado.
