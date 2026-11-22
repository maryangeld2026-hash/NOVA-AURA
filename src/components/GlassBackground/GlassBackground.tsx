import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import Svg, {Defs, RadialGradient, Rect, Stop} from 'react-native-svg';

import {GLASS} from '../../theme/tokens';

const GRID_STEP = 36;

/**
 * NOVA Glass backdrop: deep-space gradient, two slow-breathing neon glows,
 * a faint holographic grid and a scan line that sweeps top to bottom.
 *
 * Rendered once behind the whole navigator; every screen is translucent so
 * this is what gives the glass panels their depth. Pure JS (linear-gradient
 * and svg are already native deps), so it adds nothing to the native build.
 */
export const GlassBackground: React.FC = () => {
  const {width, height} = useWindowDimensions();
  const breathe = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const scanLoop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    breatheLoop.start();
    scanLoop.start();
    return () => {
      breatheLoop.stop();
      scanLoop.stop();
    };
  }, [breathe, scan]);

  const glowOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const glowScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const scanY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, height + 40],
  });

  const cols = Math.ceil(width / GRID_STEP);
  const rows = Math.ceil(height / GRID_STEP);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[GLASS.deep, GLASS.navy, '#04122A', GLASS.deep]}
        locations={[0, 0.35, 0.7, 1]}
        start={{x: 0.1, y: 0}}
        end={{x: 0.9, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {opacity: glowOpacity, transform: [{scale: glowScale}]},
        ]}>
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="cyanGlow" cx="15%" cy="12%" r="55%">
              <Stop offset="0" stopColor={GLASS.cyan} stopOpacity={0.28} />
              <Stop offset="1" stopColor={GLASS.cyan} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="violetGlow" cx="90%" cy="85%" r="60%">
              <Stop offset="0" stopColor={GLASS.violet} stopOpacity={0.26} />
              <Stop offset="1" stopColor={GLASS.violet} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#cyanGlow)" />
          <Rect width={width} height={height} fill="url(#violetGlow)" />
        </Svg>
      </Animated.View>

      {/* Holographic grid */}
      {Array.from({length: cols}, (_, i) => (
        <View
          key={`c${i}`}
          style={[styles.gridV, {left: i * GRID_STEP, height}]}
        />
      ))}
      {Array.from({length: rows}, (_, i) => (
        <View
          key={`r${i}`}
          style={[styles.gridH, {top: i * GRID_STEP, width}]}
        />
      ))}

      <Animated.View
        style={[styles.scanLine, {width, transform: [{translateY: scanY}]}]}>
        <LinearGradient
          colors={[
            'rgba(94,234,255,0)',
            'rgba(94,234,255,0.10)',
            'rgba(94,234,255,0)',
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridV: {
    position: 'absolute',
    top: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(94, 234, 255, 0.05)',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(94, 234, 255, 0.05)',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 40,
  },
});
