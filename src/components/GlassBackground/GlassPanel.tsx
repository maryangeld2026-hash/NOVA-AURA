import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';

interface GlassPanelProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Neon rim colour; defaults to the cyan glass rim. */
  glow?: string;
  testID?: string;
}

/**
 * A frosted-glass card: translucent fill, a diagonal light sheen and a
 * thin glowing rim. Use for any floating panel in the NOVA Glass look.
 */
export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  style,
  glow = 'rgba(94, 234, 255, 0.35)',
  testID,
}) => (
  <View
    testID={testID}
    style={[styles.panel, {borderColor: glow, shadowColor: glow}, style]}>
    <LinearGradient
      pointerEvents="none"
      colors={[
        'rgba(255,255,255,0.14)',
        'rgba(255,255,255,0.03)',
        'rgba(255,255,255,0.00)',
      ]}
      locations={[0, 0.45, 1]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={StyleSheet.absoluteFill}
    />
    {children}
  </View>
);

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(14, 32, 64, 0.45)',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 0,
  },
});
