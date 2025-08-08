import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import AddBookModal from '../../components/AddBookModal';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList } from '../../utils/types';

type LibraryNavigationProp = StackNavigationProp<LibraryStackParamList, 'Library'>;

export default function Library() {
  const { theme } = useTheme();
  const navigation = useNavigation<LibraryNavigationProp>();
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const handleScanBarcode = () => {
    navigation.navigate('ScanBarcode' as never);
  };

  const handleSearchOpenLibrary = () => {
    navigation.navigate('SearchBook' as never);
  };

  const handleAddManually = () => {
    navigation.navigate('AddBook');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={{ color: theme.colors.onSurface }}>Library Screen</Text>
      
      <AddBookModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onScanBarcode={handleScanBarcode}
        onSearchOpenLibrary={handleSearchOpenLibrary}
        onAddManually={handleAddManually}
      />
      
      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setModalVisible(true)}
        color="#FFFFFF"
        size="medium"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: scale(16),
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    elevation:0,
    shadowOpacity:0
  },
});
