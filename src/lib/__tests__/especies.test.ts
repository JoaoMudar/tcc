import { describe, expect, it } from 'vitest';
import { duplicateMessage, nomeExibido, normalizeBusca, parseEspecieFields, splitNomes } from '../especies';
import { FOTO_MAX_BYTES, detectImageType, fotoIdFromUrl, fotoUrl, readFotoFile } from '../fotos';

describe('parseEspecieFields (RF-10)', () => {
  it('limpa o nome científico e separa os nomes populares, o primeiro é o principal', () => {
    const parsed = parseEspecieFields({
      nomeCientifico: '  Cedrela   fissilis ',
      nomesPopulares: 'Cedro-rosa\ncedro-vermelho, acaju;CEDRO-ROSA',
      caracteristicas: ['nativa', 'madeireira', 'nativa'],
      observacoes: '',
    });
    expect(parsed).toEqual({
      value: {
        nomeCientifico: 'Cedrela fissilis',
        nomesPopulares: ['Cedro-rosa', 'cedro-vermelho', 'acaju'],
        caracteristicas: ['nativa', 'madeireira'],
        observacoes: null,
      },
    });
  });

  it('recusa característica fora da lista e nome científico curto', () => {
    const base = { nomeCientifico: 'Cedrela fissilis', nomesPopulares: '', caracteristicas: [], observacoes: '' };
    expect(parseEspecieFields({ ...base, caracteristicas: ['medicinal'] })).toEqual({ error: 'Característica desconhecida.' });
    expect(parseEspecieFields({ ...base, nomeCientifico: 'Ce' })).toHaveProperty('error');
    expect(parseEspecieFields({ ...base, nomesPopulares: 'x'.repeat(61) })).toHaveProperty('error');
  });

  it('sem nome popular, a tela mostra o científico', () => {
    expect(nomeExibido({ nomeCientifico: 'Araucaria angustifolia', nomesPopulares: [] })).toBe('Araucaria angustifolia');
    expect(nomeExibido({ nomeCientifico: 'Araucaria angustifolia', nomesPopulares: ['Araucária'] })).toBe('Araucária');
  });

  it('a busca ignora acento e maiúscula', () => {
    expect(normalizeBusca(' Ipê-Amarelo ')).toBe('ipe-amarelo');
    expect(splitNomes('')).toEqual([]);
  });

  it('nome científico repetido', () => {
    expect(duplicateMessage({ code: '23505', constraint: 'especies_nome_cientifico_key' })).toBe(
      'Já existe espécie com esse nome científico.',
    );
  });
});

describe('fotos', () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('reconhece o tipo pelos bytes', () => {
    expect(detectImageType(webp)).toBe('image/webp');
    expect(detectImageType(jpeg)).toBe('image/jpeg');
    expect(detectImageType(png)).toBe('image/png');
    expect(detectImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
  });

  it('URL e identificador vão e voltam, e URL forjada não vira id', () => {
    const id = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
    expect(fotoIdFromUrl(fotoUrl(id))).toBe(id);
    expect(fotoIdFromUrl('/uploads/foto.png')).toBeNull();
    expect(fotoIdFromUrl(null)).toBeNull();
  });

  it('arquivo ausente é sem foto; texto disfarçado e arquivo grande são recusados', async () => {
    expect(await readFotoFile(null)).toEqual({ value: null });
    expect(await readFotoFile(new File([], 'vazio.jpg'))).toEqual({ value: null });
    expect(await readFotoFile(new File(['<html>'], 'foto.jpg', { type: 'image/jpeg' }))).toHaveProperty('error');
    expect(await readFotoFile(new File([new Uint8Array(FOTO_MAX_BYTES + 1)], 'grande.jpg'))).toHaveProperty('error');

    const ok = await readFotoFile(new File([jpeg], 'foto.jpg'));
    expect(ok).toHaveProperty('value.tipo', 'image/jpeg');
  });
});
