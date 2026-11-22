import {Dimensions, StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

const dialogHeight = Dimensions.get('window').height * 0.65;

export const createStyles = (theme: Theme, scrollableBorderShown?: boolean) =>
  StyleSheet.create({
    dialog: {
      //maxHeight: '90%',
      backgroundColor: theme.colors.menuBackground,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      margin: 0,
      padding: 0,
      width: '92%',
      alignSelf: 'center',
    },
    dialogTitle: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    dialogContent: {
      maxHeight: dialogHeight,
      paddingHorizontal: 24,
      borderTopWidth: scrollableBorderShown ? 1 : 0,
      borderBottomWidth: scrollableBorderShown ? 1 : 0,
      backgroundColor: 'transparent',
    },
    dialogActionButton: {
      minWidth: 70,
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
  });
