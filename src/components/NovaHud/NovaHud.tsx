import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {observer} from 'mobx-react';
import Svg, {Circle} from 'react-native-svg';

import {GlassPanel} from '../GlassBackground';
import {modelStore, novaStore, uiStore} from '../../store';
import {GLASS} from '../../theme/tokens';
import {
  SystemStatus,
  formatGB,
  getSystemStatus,
} from '../../services/nova/systemStatus';

const REFRESH_MS = 5000;

const es = () => uiStore.language === 'es';

interface GaugeProps {
  label: string;
  value: string;
  ratio: number | null;
  color: string;
}

/** Thin circular arc gauge, HUD style. */
const Gauge: React.FC<GaugeProps> = ({label, value, ratio, color}) => {
  const size = 54;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.gauge} accessibilityLabel={`${label} ${value}`}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(120, 220, 255, 0.15)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.gaugeCenter} pointerEvents="none">
        <Text style={[styles.gaugeValue, {color}]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={styles.gaugeLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const levelColor = (ratio: number | null, invert = false) => {
  if (ratio === null) {
    return GLASS.cyan;
  }
  const v = invert ? 1 - ratio : ratio;
  if (v < 0.2) {
    return GLASS.red;
  }
  if (v < 0.4) {
    return GLASS.amber;
  }
  return GLASS.cyan;
};

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

interface NovaHudProps {
  onBriefing: () => void;
}

/**
 * Holographic status HUD pinned above the chat: live battery, RAM,
 * storage and generation speed, the loaded model, running timers and a
 * one-tap "briefing" that asks NOVA for a spoken status report.
 */
export const NovaHud: React.FC<NovaHudProps> = observer(({onBriefing}) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;
  const expanded = novaStore.hudExpanded;
  const modelName = modelStore.activeModel?.name;
  const hasTimers = novaStore.timers.length > 0;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      getSystemStatus()
        .then(s => alive && setStatus(s))
        .catch(() => undefined);
    };
    refresh();
    if (!expanded) {
      return () => {
        alive = false;
      };
    }
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [expanded, modelName]);

  useEffect(() => {
    if (!hasTimers) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimers]);

  const orbScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });
  const orbOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const online = !!modelName;
  const ramRatio =
    status?.ramUsedBytes != null && status.ramTotalBytes
      ? status.ramUsedBytes / status.ramTotalBytes
      : null;
  const diskFreeRatio =
    status?.diskFreeBytes != null && status.diskTotalBytes
      ? status.diskFreeBytes / status.diskTotalBytes
      : null;
  const tps = status?.tokensPerSecond ?? null;

  return (
    <GlassPanel style={styles.panel} testID="nova-hud">
      <Pressable
        style={styles.headerRow}
        onPress={() => novaStore.toggleHud()}
        accessibilityRole="button"
        accessibilityLabel={es() ? 'Mostrar u ocultar HUD' : 'Toggle HUD'}>
        <Animated.View
          style={[
            styles.orb,
            {
              backgroundColor: online ? GLASS.cyan : GLASS.amber,
              shadowColor: online ? GLASS.cyan : GLASS.amber,
              opacity: orbOpacity,
              transform: [{scale: orbScale}],
            },
          ]}
        />
        <Text style={styles.brand}>NOVA</Text>
        <Text
          style={[styles.state, {color: online ? GLASS.green : GLASS.amber}]}
          numberOfLines={1}>
          {online
            ? es()
              ? '· EN LÍNEA'
              : '· ONLINE'
            : es()
              ? '· SIN MODELO'
              : '· NO MODEL'}
        </Text>
        <View style={styles.flex} />
        {hasTimers && (
          <Text style={styles.timerBadge}>
            ⏱ {formatCountdown(novaStore.timers[0].endsAt - now)}
          </Text>
        )}
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded && (
        <>
          <View style={styles.gauges}>
            <Gauge
              label={es() ? 'BATERÍA' : 'BATTERY'}
              value={
                status?.batteryLevel != null
                  ? `${Math.round(status.batteryLevel * 100)}%`
                  : '—'
              }
              ratio={status?.batteryLevel ?? null}
              color={levelColor(status?.batteryLevel ?? null)}
            />
            <Gauge
              label="RAM"
              value={ramRatio !== null ? `${Math.round(ramRatio * 100)}%` : '—'}
              ratio={ramRatio}
              color={levelColor(ramRatio, true)}
            />
            <Gauge
              label={es() ? 'LIBRE' : 'FREE'}
              value={formatGB(status?.diskFreeBytes ?? null).replace(
                ' GB',
                'G',
              )}
              ratio={diskFreeRatio}
              color={levelColor(diskFreeRatio)}
            />
            <Gauge
              label="TOK/S"
              value={tps !== null ? tps.toFixed(tps < 10 ? 1 : 0) : '—'}
              ratio={tps !== null ? Math.min(1, tps / 40) : null}
              color={GLASS.violet}
            />
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.model} numberOfLines={1}>
              {modelName
                ? `◈ ${modelName}`
                : es()
                  ? '◈ Carga un modelo desde el menú ☰ → Modelos'
                  : '◈ Load a model from ☰ → Models'}
            </Text>
            <Pressable
              onPress={onBriefing}
              style={({pressed}) => [
                styles.briefing,
                pressed && styles.briefingPressed,
              ]}
              accessibilityRole="button"
              testID="nova-briefing">
              <Text style={styles.briefingText}>
                {es() ? 'INFORME' : 'BRIEFING'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </GlassPanel>
  );
});

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 0},
  },
  brand: {
    color: GLASS.text,
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    letterSpacing: 4,
  },
  state: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  flex: {flex: 1},
  timerBadge: {
    color: GLASS.amber,
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    color: GLASS.cyan,
    fontSize: 14,
    paddingHorizontal: 4,
  },
  gauges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  gauge: {
    alignItems: 'center',
    width: 64,
  },
  gaugeCenter: {
    position: 'absolute',
    top: 0,
    height: 54,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  gaugeLabel: {
    marginTop: 4,
    color: 'rgba(200, 230, 250, 0.62)',
    fontFamily: 'Inter-Medium',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  model: {
    flex: 1,
    color: 'rgba(200, 230, 250, 0.8)',
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  briefing: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS.cyan,
    backgroundColor: 'rgba(94, 234, 255, 0.12)',
  },
  briefingPressed: {
    backgroundColor: 'rgba(94, 234, 255, 0.3)',
  },
  briefingText: {
    color: GLASS.cyan,
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    letterSpacing: 2,
  },
});
