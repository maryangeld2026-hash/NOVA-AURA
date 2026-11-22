import React from 'react';
import {StyleSheet, View} from 'react-native';
import {BottomSheetBackgroundProps} from '@gorhom/bottom-sheet';
import LinearGradient from 'react-native-linear-gradient';

// NOVA Glass sheet: dark frosted pane with a cyan rim and a top sheen.
export const SheetBackground = ({style}: BottomSheetBackgroundProps) => (
  <View
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel="Bottom Sheet"
    style={[styles.background, style]}>
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(94,234,255,0.14)', 'rgba(94,234,255,0)']}
      style={styles.sheen}
    />
  </View>
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: 'rgba(8, 20, 44, 0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(94, 234, 255, 0.35)',
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
});
