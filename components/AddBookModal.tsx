import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Card, List, Button, Text, Portal } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';

interface AddBookModalProps {
  visible: boolean;
  onDismiss: () => void;
  onScanBarcode: () => void;
  onSearchOpenLibrary: () => void;
  onAddManually: () => void;
}

const AddBookModal: React.FC<AddBookModalProps> = ({
  visible,
  onDismiss,
  onScanBarcode,
  onSearchOpenLibrary,
  onAddManually,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        <Card style={{ backgroundColor: theme.colors.surface }}>
          <Card.Content>
            <Text 
              variant="titleLarge" 
              style={[
                styles.title, 
                { color: theme.colors.onSurface }
              ]}
            >
              {t('library.selectAddMethod')}
            </Text>

            <List.Item
              title={t('library.scanBarcode')}
              description={t('library.scanBarcodeDescription')}
              left={(props) => (
                <List.Icon {...props} icon="barcode-scan" color={theme.colors.primary} />
              )}
              onPress={() => {
                onDismiss();
                onScanBarcode();
              }}
              style={styles.listItem}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurface, opacity: 0.7 }}
            />

            <List.Item
              title={t('library.searchOpenLibrary')}
              description={t('library.searchDescription')}
              left={(props) => (
                <List.Icon {...props} icon="magnify" color={theme.colors.primary} />
              )}
              onPress={() => {
                onDismiss();
                onSearchOpenLibrary();
              }}
              style={styles.listItem}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurface, opacity: 0.7 }}
            />

            <List.Item
              title={t('library.addManually')}
              description={t('library.manualDescription')}
              left={(props) => (
                <List.Icon {...props} icon="pencil-plus" color={theme.colors.primary} />
              )}
              onPress={() => {
                onDismiss();
                onAddManually();
              }}
              style={styles.listItem}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurface, opacity: 0.7 }}
            />

            <Button
              mode="outlined"
              onPress={onDismiss}
              style={[
                styles.cancelButton,
                { borderColor: theme.colors.outline }
              ]}
              textColor={theme.colors.onSurface}
            >
              Cancel
            </Button>
          </Card.Content>
        </Card>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: scale(20),
    borderRadius: scale(12),
  },
  title: {
    textAlign: 'center',
    marginBottom: verticalScale(16),
    fontWeight: '600',
  },
  listItem: {
    paddingHorizontal: 0,
    marginBottom: verticalScale(4),
  },
  cancelButton: {
    marginTop: verticalScale(16),
  },
});

export default AddBookModal;
