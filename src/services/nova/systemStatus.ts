import DeviceInfo from 'react-native-device-info';

import {chatSessionStore, modelStore} from '../../store';
import type {PersistedTurnTimings} from '../../utils/completionTypes';

export interface SystemStatus {
  /** 0..1, or null when the platform will not say. */
  batteryLevel: number | null;
  charging: boolean;
  ramUsedBytes: number | null;
  ramTotalBytes: number | null;
  diskFreeBytes: number | null;
  diskTotalBytes: number | null;
  modelName: string | null;
  /** Generation speed of the last assistant reply in this chat. */
  tokensPerSecond: number | null;
  timestamp: Date;
}

const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

const finiteOrNull = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;

/** Generation speed of the most recent assistant turn that reported timings. */
export const lastTokensPerSecond = (): number | null => {
  for (const m of chatSessionStore.currentSessionMessages) {
    const timings = (m.metadata as {timings?: PersistedTurnTimings} | undefined)
      ?.timings;
    const tps = finiteOrNull(timings?.predicted_per_second);
    if (tps !== null) {
      return tps;
    }
  }
  return null;
};

export const getSystemStatus = async (): Promise<SystemStatus> => {
  const [battery, power, used, total, free, disk] = await Promise.all([
    safe(() => DeviceInfo.getBatteryLevel()),
    safe(() => DeviceInfo.getPowerState()),
    safe(() => DeviceInfo.getUsedMemory()),
    safe(() => DeviceInfo.getTotalMemory()),
    safe(() => DeviceInfo.getFreeDiskStorage()),
    safe(() => DeviceInfo.getTotalDiskCapacity()),
  ]);
  const level = finiteOrNull(battery);
  return {
    batteryLevel: level !== null && level <= 1 ? level : null,
    charging:
      power?.batteryState === 'charging' || power?.batteryState === 'full',
    ramUsedBytes: finiteOrNull(used),
    ramTotalBytes: finiteOrNull(total),
    diskFreeBytes: finiteOrNull(free),
    diskTotalBytes: finiteOrNull(disk),
    modelName: modelStore.activeModel?.name ?? null,
    tokensPerSecond: lastTokensPerSecond(),
    timestamp: new Date(),
  };
};

const GB = 1024 ** 3;
export const formatGB = (bytes: number | null): string =>
  bytes === null ? '—' : `${(bytes / GB).toFixed(1)} GB`;

export const formatPercent = (ratio: number | null): string =>
  ratio === null ? '—' : `${Math.round(ratio * 100)}%`;

/**
 * Plain-text telemetry block handed to the model for a briefing. The
 * persona prompt tells NOVA to read it as live data.
 */
export const formatStatusBlock = (s: SystemStatus, locale = 'es'): string => {
  const time = s.timestamp.toLocaleString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const ram =
    s.ramUsedBytes !== null && s.ramTotalBytes
      ? `${formatGB(s.ramUsedBytes)} / ${formatGB(s.ramTotalBytes)}`
      : '—';
  return [
    '[SYSTEM STATUS]',
    `time: ${time}`,
    `battery: ${formatPercent(s.batteryLevel)}${s.charging ? ' (charging)' : ''}`,
    `ram: ${ram}`,
    `storage free: ${formatGB(s.diskFreeBytes)} of ${formatGB(s.diskTotalBytes)}`,
    `model: ${s.modelName ?? 'none loaded'}`,
    `speed: ${s.tokensPerSecond !== null ? `${s.tokensPerSecond.toFixed(1)} tok/s` : '—'}`,
    '[/SYSTEM STATUS]',
  ].join('\n');
};
