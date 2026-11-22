/**
 * NOVA command layer.
 *
 * Short, imperative messages ("nuevo chat", "pon un temporizador de 5
 * minutos", "cambia al modelo qwen", "informe de estado") are recognised
 * here before they reach the language model, so they work instantly and
 * offline even with a 1B model, and identically whether typed or spoken in
 * voice mode. Anything that does not match is passed through unchanged.
 *
 * `parseNovaCommand` is pure (unit-tested); side effects live in
 * `runNovaCommand`, which receives its dependencies explicitly.
 */

export type NovaCommand =
  | {kind: 'newChat'}
  | {kind: 'status'}
  | {kind: 'time'}
  | {kind: 'timer'; ms: number; label: string}
  | {kind: 'cancelTimers'}
  | {kind: 'readLast'}
  | {kind: 'stopSpeaking'}
  | {kind: 'switchModel'; query: string}
  | {kind: 'switchPal'; query: string}
  | {kind: 'listModels'}
  | {kind: 'setName'; name: string}
  | {kind: 'help'};

const MAX_COMMAND_LENGTH = 90;

/** Lowercase, strip accents and punctuation, collapse spaces, drop the wake word. */
export const normalizeCommandText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:"“”'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:oye|hey|hola|ok|okay)\s+)?nova\s*/, '')
    .replace(/^(?:por favor|please)\s+/, '')
    .replace(/\s+(?:por favor|please)$/, '')
    .trim();

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  one: 1,
  a: 1,
  an: 1,
  dos: 2,
  two: 2,
  tres: 3,
  three: 3,
  cuatro: 4,
  four: 4,
  cinco: 5,
  five: 5,
  seis: 6,
  six: 6,
  siete: 7,
  seven: 7,
  ocho: 8,
  eight: 8,
  nueve: 9,
  nine: 9,
  diez: 10,
  ten: 10,
  quince: 15,
  fifteen: 15,
  veinte: 20,
  twenty: 20,
  treinta: 30,
  thirty: 30,
  cuarenta: 40,
  forty: 40,
  sesenta: 60,
  sixty: 60,
};

const UNIT_MS: Array<[RegExp, number, string]> = [
  [/^(?:s|seg|segs|segundo|segundos|sec|secs|second|seconds)$/, 1000, 's'],
  [/^(?:m|min|mins|minuto|minutos|minute|minutes)$/, 60_000, 'min'],
  [/^(?:h|hr|hrs|hora|horas|hour|hours)$/, 3_600_000, 'h'],
];

const parseTimer = (t: string): NovaCommand | null => {
  if (
    !/\b(?:temporizador|timer|cuenta atras|cuenta regresiva|avisame|recuerdame|alarma|countdown|remind me)\b/.test(
      t,
    )
  ) {
    return null;
  }
  if (/\bmedia hora\b|\bhalf an hour\b/.test(t)) {
    return {kind: 'timer', ms: 30 * 60_000, label: '30 min'};
  }
  const m = t.match(
    /\b(\d+(?:[.,]\d+)?|[a-z]+)\s+(s|seg|segs|segundos?|secs?|seconds?|m|min|mins|minutos?|minutes?|h|hrs?|horas?|hours?)\b/,
  );
  if (!m) {
    return null;
  }
  const raw = m[1].replace(',', '.');
  const n = /^\d/.test(raw) ? parseFloat(raw) : NUMBER_WORDS[raw];
  if (!n || !Number.isFinite(n) || n <= 0) {
    return null;
  }
  const unit = UNIT_MS.find(([re]) => re.test(m[2]));
  if (!unit) {
    return null;
  }
  const ms = Math.round(n * unit[1]);
  if (ms < 1000 || ms > 24 * 3_600_000) {
    return null;
  }
  return {kind: 'timer', ms, label: `${n} ${unit[2]}`};
};

export const parseNovaCommand = (text: string): NovaCommand | null => {
  if (!text || text.length > MAX_COMMAND_LENGTH || text.includes('\n')) {
    return null;
  }
  const t = normalizeCommandText(text);
  if (!t) {
    return null;
  }

  if (
    /^(?:nuevo chat|nueva conversacion|nueva charla|empieza de nuevo|borron y cuenta nueva|new chat|new conversation|start over)$/.test(
      t,
    )
  ) {
    return {kind: 'newChat'};
  }
  if (
    /^(?:(?:dame )?(?:el |mi )?(?:informe|reporte|resumen)(?: de estado| diario| del sistema| del dia)?|estado del sistema|diagnostico|briefing|daily briefing|status(?: report)?|system status)$/.test(
      t,
    )
  ) {
    return {kind: 'status'};
  }
  if (
    /^(?:que hora es|dime la hora|la hora|hora|what time is it|time)$/.test(t)
  ) {
    return {kind: 'time'};
  }
  if (
    /^(?:cancela(?:r)?|quita(?:r)?|borra(?:r)?|cancel|stop|clear) (?:(?:el|los|todos los|mi|mis|the|all|my) )?(?:temporizador(?:es)?|alarmas?|timers?)$/.test(
      t,
    )
  ) {
    return {kind: 'cancelTimers'};
  }
  const timer = parseTimer(t);
  if (timer) {
    return timer;
  }
  if (
    /^(?:lee(?:lo|la)?|leelo|repite(?:lo)?|read(?: it| that)?)(?: (?:otra vez|de nuevo|again))?(?: (?:en voz alta|aloud|out loud))?(?: (?:la ultima respuesta|el ultimo mensaje|eso|the last (?:answer|reply|message)))?$/.test(
      t,
    )
  ) {
    return {kind: 'readLast'};
  }
  if (
    /^(?:silencio|callate|calla|para de hablar|deja de hablar|stop talking|be quiet|shut up|mute)$/.test(
      t,
    )
  ) {
    return {kind: 'stopSpeaking'};
  }
  if (
    /^(?:que modelos tengo|(?:lista|listar|muestra|muestrame) (?:los |mis )?modelos|modelos disponibles|list (?:my )?models|which models do i have)$/.test(
      t,
    )
  ) {
    return {kind: 'listModels'};
  }
  const model = t.match(
    /^(?:cambia(?:r)?|usa(?:r)?|carga(?:r)?|activa(?:r)?|pon|switch|load|use)(?: (?:a|al|el|la|to|the))? (?:modelo|model) (.+)$/,
  );
  if (model) {
    return {kind: 'switchModel', query: model[1].trim()};
  }
  const pal = t.match(
    /^(?:cambia(?:r)? (?:a|al) pal|habla(?:r)? con|pasame (?:a|con)|quiero hablar con|switch to pal|talk to|let me talk to) (.+)$/,
  );
  if (pal) {
    return {kind: 'switchPal', query: pal[1].trim()};
  }
  const name = t.match(
    /^(?:llamame|me llamo|mi nombre es|call me|my name is) ([a-z][a-z ]{0,38})$/,
  );
  if (name) {
    const pretty = name[1]
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return {kind: 'setName', name: pretty};
  }
  if (
    /^(?:ayuda|comandos|que puedes hacer|que sabes hacer|help|commands|what can you do)$/.test(
      t,
    )
  ) {
    return {kind: 'help'};
  }
  return null;
};

/** Best match by normalised substring / token overlap; null if nothing plausible. */
export const fuzzyFind = <T>(
  items: readonly T[],
  getName: (item: T) => string,
  query: string,
): T | null => {
  const q = normalizeCommandText(query).replace(/[-_/]/g, ' ');
  if (!q) {
    return null;
  }
  const qTokens = q.split(' ').filter(Boolean);
  let best: {item: T; score: number} | null = null;
  for (const item of items) {
    const name = normalizeCommandText(getName(item)).replace(/[-_/]/g, ' ');
    let score = 0;
    if (name === q) {
      score = 100;
    } else if (name.includes(q)) {
      score = 50 + q.length;
    } else {
      const hits = qTokens.filter(tok => name.includes(tok)).length;
      score = hits === qTokens.length ? 20 + hits : hits > 0 ? hits : 0;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = {item, score};
    }
  }
  return best ? best.item : null;
};
