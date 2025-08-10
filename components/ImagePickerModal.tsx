import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Card, List, Button, Text, Portal } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';

interface ImagePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onCamera: () => void;
  onGallery: () => void;
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  visible,
  onDismiss,
  onCamera,
  onGallery,
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
              {t('addBook.selectImage')}
            </Text>

            <Text 
              variant="bodyMedium" 
              style={[
                styles.subtitle, 
                { color: theme.colors.onSurfaceVariant }
              ]}
            >
              {t('addBook.selectImageMessage')}
            </Text>

            <List.Item
              title={t('addBook.camera')}
              description="Take a photo with your camera"
              left={(props) => (
                <List.Icon {...props} icon="camera" color={theme.colors.primary} />
              )}
              onPress={() => {
                onDismiss();
                onCamera();
              }}
              style={styles.listItem}
              titleStyle={{ color: theme.colors.onSurface }}
              descriptionStyle={{ color: theme.colors.onSurface, opacity: 0.7 }}
            />

            <List.Item
              title={t('addBook.gallery')}
              description="Choose from your photo library"
              left={(props) => (
                <List.Icon {...props} icon="image" color={theme.colors.primary} />
              )}
              onPress={() => {
                onDismiss();
                onGallery();
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
              {t('scanner.cancel')}
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
    marginBottom: verticalScale(8),
    fontWeight: '600',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: verticalScale(20),
    opacity: 0.8,
  },
  listItem: {
    paddingHorizontal: 0,
    marginBottom: verticalScale(4),
  },
  cancelButton: {
    marginTop: verticalScale(16),
  },
});

export default ImagePickerModal;
