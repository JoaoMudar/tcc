import { notFound } from 'next/navigation';
import { formatData, isDataIso } from '@/lib/datas';
import pool from '@/lib/db';
import { SITUACOES_PEDIDO } from '@/lib/pedidos-rotulos';
import { AVISOS_DA_ROTA, formatDistancia, isAvisoDaRota } from '@/lib/rotas';
import { type PedidoParaViagem, cargasDaViagem, listParadas, partidasBase, pedidosDisponiveis, viagemDoDia } from '@/lib/viagens';
import { requirePageAccess } from '@/lib/auth/guards';
import { CabecalhoViagem } from './CabecalhoViagem';
import { CarregarViagem } from './CarregarViagem';
import { MontarCarga, type PedidoParaEscolher } from './MontarCarga';
import { type EscolhaDePartida, RotaDaViagem } from './RotaDaViagem';

interface PlanejarPageProps {
  params: Promise<{ data: string }>;
  searchParams: Promise<{ aviso?: string; nova?: string }>;
}

function local(pedido: { cidade: string | null; logradouro: string | null }): string | null {
  return [pedido.cidade, pedido.logradouro].filter(Boolean).join(' · ') || null;
}

function paraEscolher(pedido: PedidoParaViagem, dia: string): PedidoParaEscolher {
  return {
    id: pedido.id,
    numero: pedido.numero,
    cliente: pedido.cliente,
    local: local(pedido),
    itens: pedido.itens,
    // O aprovado é o caso comum e não precisa dizer; o resto já tem carga
    situacao: pedido.situacao === 'aprovado' ? null : SITUACOES_PEDIDO[pedido.situacao],
    entrega:
      pedido.dataEntrega === dia ? '' : pedido.dataEntrega ? `entrega ${formatData(pedido.dataEntrega).slice(0, 5)}` : 'sem data',
  };
}

/**
 * P14: a rotina "Planejar pedido", a viagem de entrega de um dia. A etapa não é
 * escolha da pessoa, é `viagens.situacao`: quem sai no meio volta exatamente
 * onde parou, pelo calendário.
 */
export default async function PlanejarPage({ params, searchParams }: PlanejarPageProps) {
  await requirePageAccess('cargas_pedido');
  const { data } = await params;
  if (!isDataIso(data)) notFound();
  const { aviso, nova } = await searchParams;

  const viagem = await viagemDoDia(pool, data, { nova: nova === '1' });
  const etapa = viagem?.situacao ?? 'montando';

  return (
    <main className="flex min-h-dvh flex-col bg-surface">
      <CabecalhoViagem data={data} viagemId={viagem?.id ?? null} etapa={etapa} />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">{await conteudo()}</div>
    </main>
  );

  async function conteudo() {
    if (!viagem || etapa === 'montando') {
      const [paradas, disponiveis] = await Promise.all([
        viagem ? listParadas(pool, viagem.id) : Promise.resolve([]),
        pedidosDisponiveis(pool),
      ]);
      return (
        <MontarCarga
          data={data}
          viagemId={viagem?.id ?? null}
          carga={paradas
            .filter((parada) => parada.pedidoId !== null)
            .map((parada) => ({
              id: parada.pedidoId!,
              numero: parada.numero!,
              cliente: parada.cliente!,
              local: local(parada),
              itens: parada.itens,
            }))}
          marcados={disponiveis.filter((p) => p.dataEntrega === data).map((p) => paraEscolher(p, data))}
          abertos={disponiveis.filter((p) => p.dataEntrega !== data).map((p) => paraEscolher(p, data))}
        />
      );
    }

    if (etapa === 'roteirizando') {
      const [paradas, base] = await Promise.all([listParadas(pool, viagem.id), partidasBase(pool)]);
      const escolha = (descricao: string): EscolhaDePartida =>
        descricao === base.agrolandia ? 'agrolandia' : descricao === base.itapema ? 'itapema' : 'outro';
      // Sem volta escolhida, o caminhão volta para onde saiu
      const chegada =
        viagem.chegadaDescricao === null
          ? { descricao: viagem.partidaDescricao, lat: viagem.partidaLat, lng: viagem.partidaLng }
          : { descricao: viagem.chegadaDescricao, lat: viagem.chegadaLat, lng: viagem.chegadaLng };
      return (
        <RotaDaViagem
          // A ordem que o servidor devolve é a da tela: a lista só recomeça quando outra pessoa a mudou
          key={paradas.map((parada) => parada.id).join(',')}
          data={data}
          viagemId={viagem.id}
          partida={{
            descricao: viagem.partidaDescricao,
            lat: viagem.partidaLat,
            lng: viagem.partidaLng,
            escolha: escolha(viagem.partidaDescricao),
          }}
          chegada={{ ...chegada, escolha: escolha(chegada.descricao) }}
          paradas={paradas.map((parada) => ({
            id: parada.id,
            pedidoId: parada.pedidoId,
            numero: parada.numero,
            cliente: parada.cliente,
            cidade: parada.cidade,
            descricao: parada.descricao,
            endereco: parada.endereco,
            lat: parada.lat,
            lng: parada.lng,
            naoAchado: parada.naoAchado,
          }))}
          distancia={viagem.distanciaM === null ? null : formatDistancia(viagem.distanciaM, viagem.duracaoS)}
          aviso={isAvisoDaRota(aviso) ? AVISOS_DA_ROTA[aviso] : null}
        />
      );
    }

    const grupos = await cargasDaViagem(pool, viagem.id);
    return (
      <CarregarViagem
        data={data}
        viagemId={viagem.id}
        pronta={etapa === 'pronta'}
        grupos={grupos.map((grupo) => ({
          pedidoId: grupo.pedidoId,
          cliente: grupo.cliente,
          cidade: grupo.cidade,
          entrega: grupo.entrega,
          itens: grupo.itens.map((item) => ({
            id: item.id,
            especie: item.especie,
            recipiente: item.recipiente,
            alturaM: item.alturaM,
            quantidade: item.quantidade,
            separado: item.separado,
            carregado: item.carregado,
          })),
        }))}
      />
    );
  }
}
