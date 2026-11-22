import {fuzzyFind, normalizeCommandText, parseNovaCommand} from '../commands';

describe('normalizeCommandText', () => {
  it('strips accents, punctuation and the wake word', () => {
    expect(normalizeCommandText('Oye NOVA, ¿qué hora es?')).toBe('que hora es');
    expect(normalizeCommandText('nova nuevo chat por favor')).toBe(
      'nuevo chat',
    );
  });
});

describe('parseNovaCommand', () => {
  it.each([
    ['Nuevo chat', {kind: 'newChat'}],
    ['new chat', {kind: 'newChat'}],
    ['Informe de estado', {kind: 'status'}],
    ['NOVA, dame mi informe diario', {kind: 'status'}],
    ['status report', {kind: 'status'}],
    ['¿Qué hora es?', {kind: 'time'}],
    ['Silencio', {kind: 'stopSpeaking'}],
    ['Léelo en voz alta', {kind: 'readLast'}],
    ['read it again', {kind: 'readLast'}],
    ['Cancela los temporizadores', {kind: 'cancelTimers'}],
    ['¿Qué modelos tengo?', {kind: 'listModels'}],
    ['ayuda', {kind: 'help'}],
  ])('%s', (text, expected) => {
    expect(parseNovaCommand(text)).toEqual(expected);
  });

  it('parses timers with digits and words', () => {
    expect(parseNovaCommand('Pon un temporizador de 5 minutos')).toEqual({
      kind: 'timer',
      ms: 300000,
      label: '5 min',
    });
    expect(parseNovaCommand('temporizador de cinco segundos')).toMatchObject({
      kind: 'timer',
      ms: 5000,
    });
    expect(parseNovaCommand('set a timer for 2 hours')).toMatchObject({
      kind: 'timer',
      ms: 7200000,
    });
    expect(parseNovaCommand('avísame en media hora')).toMatchObject({
      kind: 'timer',
      ms: 1800000,
    });
  });

  it('parses model, pal and name commands', () => {
    expect(parseNovaCommand('Cambia al modelo Qwen 3.5')).toEqual({
      kind: 'switchModel',
      query: 'qwen 3 5',
    });
    expect(parseNovaCommand('Habla con Codie')).toEqual({
      kind: 'switchPal',
      query: 'codie',
    });
    expect(parseNovaCommand('Llámame Tony')).toEqual({
      kind: 'setName',
      name: 'Tony',
    });
  });

  it('leaves ordinary messages for the model', () => {
    expect(parseNovaCommand('¿Cuál es la capital de Francia?')).toBeNull();
    expect(
      parseNovaCommand('Escribe un poema sobre el informe del clima'),
    ).toBeNull();
    expect(parseNovaCommand('avísame cuando termine')).toBeNull();
    expect(parseNovaCommand('dime algo bonito')).toBeNull();
    expect(parseNovaCommand('a'.repeat(200))).toBeNull();
    expect(parseNovaCommand('nuevo chat\ncon varias líneas')).toBeNull();
  });
});

describe('fuzzyFind', () => {
  const models = [
    {name: 'Gemma 3 1B'},
    {name: 'Qwen3.5-4B-Q4_K_M'},
    {name: 'LFM2.5 1.2B'},
  ];
  it('matches by substring or tokens', () => {
    expect(fuzzyFind(models, m => m.name, 'gemma')?.name).toBe('Gemma 3 1B');
    expect(fuzzyFind(models, m => m.name, 'qwen 4b')?.name).toBe(
      'Qwen3.5-4B-Q4_K_M',
    );
    expect(fuzzyFind(models, m => m.name, 'llama')).toBeNull();
  });
});
