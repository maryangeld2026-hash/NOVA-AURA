import {Vibration} from 'react-native';

import {
  chatSessionStore,
  modelStore,
  novaStore,
  palStore,
  ttsStore,
  uiStore,
} from '../../store';
import {randId} from '../../utils';
import {assistant, derivedText, user} from '../../utils/chat';
import {MessageType} from '../../utils/types';

import {NovaCommand, fuzzyFind} from './commands';
import {
  formatGB,
  formatPercent,
  formatStatusBlock,
  getSystemStatus,
} from './systemStatus';

export interface NovaSendOptions {
  /** True when the text came from hands-free voice mode. */
  spoken?: boolean;
  /** Voice mode waits on this id to know which message is "the reply". */
  onTurnCreated?: (turnId: string) => void;
}

export interface NovaRunContext {
  userText: string;
  opts: NovaSendOptions;
  /** Forward a (possibly rewritten) prompt to the normal model pipeline. */
  sendToModel: (text: string) => Promise<void>;
}

const isSpanish = () => uiStore.language === 'es';
const say = (es: string, en: string) => (isSpanish() ? es : en);

const addText = async (
  author: typeof user,
  text: string,
): Promise<MessageType.Text> => {
  const message: MessageType.Text = {
    author,
    createdAt: Date.now(),
    id: randId(),
    text,
    type: 'text',
    metadata: author === assistant ? {copyable: true} : {},
  };
  await chatSessionStore.addMessageToCurrentSession(message);
  return message;
};

const speak = async (id: string, text: string) => {
  try {
    await ttsStore.play(id, text);
  } catch (err) {
    console.warn('[NOVA] speak failed:', err);
  }
};

/** Shows the user's command and NOVA's answer, and speaks it when appropriate. */
const reply = async (
  ctx: NovaRunContext,
  text: string,
  {echoUser = true}: {echoUser?: boolean} = {},
) => {
  if (echoUser) {
    await addText(user, ctx.userText);
  }
  const message = await addText(assistant, text);
  ctx.opts.onTurnCreated?.(message.id);
  if (ctx.opts.spoken || ttsStore.autoSpeakEnabled) {
    await speak(message.id, text);
  }
};

const greetingForNow = (d = new Date()) => {
  const h = d.getHours();
  const name = novaStore.userName ? `, ${novaStore.userName}` : '';
  if (h < 12) {
    return say(`Buenos días${name}`, `Good morning${name}`);
  }
  if (h < 19) {
    return say(`Buenas tardes${name}`, `Good afternoon${name}`);
  }
  return say(`Buenas noches${name}`, `Good evening${name}`);
};

const HELP_ES = [
  'Comandos rápidos de NOVA (escritos o por voz):',
  '• "Informe de estado" — telemetría del teléfono y resumen',
  '• "¿Qué hora es?"',
  '• "Temporizador de 5 minutos" / "Cancela los temporizadores"',
  '• "Nuevo chat"',
  '• "Cambia al modelo qwen" / "¿Qué modelos tengo?"',
  '• "Habla con Codie" (cambiar de Pal)',
  '• "Léelo en voz alta" / "Silencio"',
  '• "Llámame Ana"',
].join('\n');

const HELP_EN = [
  'NOVA quick commands (typed or spoken):',
  '• "Status report" — phone telemetry and summary',
  '• "What time is it?"',
  '• "Timer 5 minutes" / "Cancel timers"',
  '• "New chat"',
  '• "Switch to model qwen" / "List models"',
  '• "Talk to Codie" (switch Pal)',
  '• "Read it aloud" / "Stop talking"',
  '• "Call me Ana"',
].join('\n');

export const runNovaCommand = async (
  cmd: NovaCommand,
  ctx: NovaRunContext,
): Promise<void> => {
  switch (cmd.kind) {
    case 'newChat': {
      await ttsStore.stop().catch(() => undefined);
      chatSessionStore.resetActiveSession();
      if (ctx.opts.spoken) {
        await reply(ctx, say('Nueva sesión lista.', 'New session ready.'), {
          echoUser: false,
        });
      }
      return;
    }

    case 'time': {
      const now = new Date();
      const time = now.toLocaleTimeString(uiStore.language, {
        hour: '2-digit',
        minute: '2-digit',
      });
      const date = now.toLocaleDateString(uiStore.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      await reply(
        ctx,
        say(`Son las ${time}, ${date}.`, `It's ${time}, ${date}.`),
      );
      return;
    }

    case 'timer': {
      novaStore.addTimer(cmd.label, cmd.ms, async timer => {
        Vibration.vibrate([0, 400, 200, 400, 200, 400]);
        const msg = await addText(
          assistant,
          say(
            `⏰ Temporizador de ${timer.label} completado.`,
            `⏰ ${timer.label} timer done.`,
          ),
        );
        await speak(msg.id, derivedText(msg));
      });
      await reply(
        ctx,
        say(
          `Temporizador de ${cmd.label} en marcha. Te aviso al terminar (mantén la app abierta).`,
          `${cmd.label} timer running. I'll ping you when it ends (keep the app open).`,
        ),
      );
      return;
    }

    case 'cancelTimers': {
      const n = novaStore.cancelAllTimers();
      await reply(
        ctx,
        n
          ? say(`Cancelados ${n} temporizador(es).`, `Cancelled ${n} timer(s).`)
          : say('No hay temporizadores activos.', 'No active timers.'),
      );
      return;
    }

    case 'stopSpeaking': {
      await ttsStore.stop().catch(() => undefined);
      return;
    }

    case 'readLast': {
      const last = chatSessionStore.currentSessionMessages.find(
        m => m.author.id === assistant.id && derivedText(m).trim().length > 0,
      );
      if (!last) {
        await reply(
          ctx,
          say('Todavía no hay nada que leer.', 'Nothing to read yet.'),
        );
        return;
      }
      ctx.opts.onTurnCreated?.(last.id);
      await speak(last.id, derivedText(last));
      return;
    }

    case 'listModels': {
      const models = modelStore.availableModels;
      const active = modelStore.activeModel?.id;
      const text = models.length
        ? say('Modelos disponibles:\n', 'Available models:\n') +
          models
            .map(m => `• ${m.name}${m.id === active ? ' ✓' : ''}`)
            .join('\n')
        : say(
            'No tienes modelos descargados. Abre Modelos en el menú para bajar uno.',
            'No downloaded models yet. Open Models in the menu to get one.',
          );
      await reply(ctx, text);
      return;
    }

    case 'switchModel': {
      const model = fuzzyFind(
        modelStore.availableModels,
        m => m.name,
        cmd.query,
      );
      if (!model) {
        await reply(
          ctx,
          say(
            `No encuentro un modelo que coincida con "${cmd.query}". Di "¿qué modelos tengo?" para ver la lista.`,
            `No model matches "${cmd.query}". Say "list models" to see them.`,
          ),
        );
        return;
      }
      await reply(
        ctx,
        say(`Cargando ${model.name}…`, `Loading ${model.name}…`),
      );
      try {
        await modelStore.selectModel(model);
        await addText(
          assistant,
          say(`${model.name} en línea.`, `${model.name} online.`),
        );
      } catch (err) {
        await addText(
          assistant,
          say(
            `No pude cargar ${model.name}: ${String(err)}`,
            `Couldn't load ${model.name}: ${String(err)}`,
          ),
        );
      }
      return;
    }

    case 'switchPal': {
      const pal = fuzzyFind(palStore.pals, p => p.name, cmd.query);
      if (!pal) {
        await reply(
          ctx,
          say(
            `No tengo ningún Pal llamado "${cmd.query}".`,
            `There's no Pal called "${cmd.query}".`,
          ),
        );
        return;
      }
      await chatSessionStore.setActivePal(pal.id);
      await reply(
        ctx,
        say(`Te paso con ${pal.name}.`, `Switching you to ${pal.name}.`),
      );
      return;
    }

    case 'setName': {
      novaStore.setUserName(cmd.name);
      await reply(
        ctx,
        say(
          `Entendido. A partir de ahora te llamaré ${cmd.name}.`,
          `Got it. I'll call you ${cmd.name} from now on.`,
        ),
      );
      return;
    }

    case 'help': {
      await reply(ctx, say(HELP_ES, HELP_EN));
      return;
    }

    case 'status': {
      const status = await getSystemStatus();
      if (modelStore.activeModel) {
        // Let the model write the briefing from live telemetry.
        const ask = say(
          `${greetingForNow()}. Dame mi informe de estado.`,
          `${greetingForNow()}. Give me my status briefing.`,
        );
        await ctx.sendToModel(
          `${ask}\n\n${formatStatusBlock(status, uiStore.language)}`,
        );
        return;
      }
      const ram =
        status.ramUsedBytes !== null && status.ramTotalBytes
          ? `${formatGB(status.ramUsedBytes)} / ${formatGB(status.ramTotalBytes)}`
          : '—';
      await reply(
        ctx,
        say(
          `${greetingForNow()}. Informe de estado:\n` +
            `🔋 Batería ${formatPercent(status.batteryLevel)}${status.charging ? ' (cargando)' : ''}\n` +
            `🧠 RAM ${ram}\n` +
            `💾 Libre ${formatGB(status.diskFreeBytes)} de ${formatGB(status.diskTotalBytes)}\n` +
            '🤖 Ningún modelo cargado: carga uno para que pueda analizar estos datos.',
          `${greetingForNow()}. Status report:\n` +
            `🔋 Battery ${formatPercent(status.batteryLevel)}${status.charging ? ' (charging)' : ''}\n` +
            `🧠 RAM ${ram}\n` +
            `💾 Free ${formatGB(status.diskFreeBytes)} of ${formatGB(status.diskTotalBytes)}\n` +
            '🤖 No model loaded: load one and I can analyse this for you.',
        ),
      );
      return;
    }
  }
};
