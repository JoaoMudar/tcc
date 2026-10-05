# P17: Telefone ao vivo, vários recipientes na conferência, total, frete e peso, e o planejar com volta

Melhorias pedidas pelo viveiro em quatro rotinas. Decisões: frete de ida e volta
(`km × 2 ÷ 17 km/L × R$ 7`, parâmetros), origem escolhida no pedido (Agrolândia ou Itapema), valor
sempre editável; peso do recipiente cheio, fixo no cadastro de recipientes.

- [x] T1. Telefone: `validateTelefone` recusa DDD inexistente e celular sem o 9; `PessoaForm` e `ClienteRapido` validam no blur e revalidam ao digitar
- [x] T2. Conferência: complemento vira lista; "Tem tudo" de item com recipiente a definir se divide em vários recipientes
- [x] T3. Migration `20261005000001_pedido_frete_e_peso.sql`: `recipientes.peso_kg`, `pedidos.frete`, `frete_origem`, `frete_distancia_km`, parâmetros do frete, trigger da coordenada
- [x] T4. Recipientes: campo de peso cheio no cadastro
- [x] T5. `frete.ts` (sugestão e peso), `distanciaDeCarro` no ORS, `sugerirFreteAction`
- [x] T6. Ficha: rodapé com subtotal, frete, total e peso; frete gravado na negociação; lista soma o frete
- [x] T7. Planejar: volta do carregamento para a rota; passos do cabeçalho clicáveis
- [ ] T8. Rota: tocar o cliente sem endereço abre o endereço de entrega; `writeEnderecos` preserva a coordenada
- [ ] T9. Localização do WhatsApp: `lerLocalizacao`, link curto, reverse geocode; campo no cadastro
- [ ] T10. Docs: CHANGELOG, C6, C8, modelo-dados-pt, rotinas; scripts de verificação
- [ ] T11. `npm test`
