import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { Text, Button, Card, ActivityIndicator } from 'react-native-paper';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { getBookByISBN, ProcessedBookData } from '../../utils/openLibraryUtils';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList } from '../../utils/types';

type ScanBarcodeNavigationProp = StackNavigationProp<LibraryStackParamList, 'ScanBarcode'>;

const { width, height } = Dimensions.get('window');

export default function ScanBarcode() {
  const { theme } = useTheme();
  const navigation = useNavigation<ScanBarcodeNavigationProp>();
  const { t } = useTranslation();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setLoading(true);

    try {
      console.log(`Bar code with type ${type} and data ${data} has been scanned!`);
      
      // Check if the scanned data looks like an ISBN
      const cleanedData = data.replace(/[-\s]/g, '');
      const isISBN = /^(97[89])?\d{10}$/.test(cleanedData) || /^\d{13}$/.test(cleanedData);
      
      if (!isISBN) {
        Alert.alert(
          t('scanner.invalidBarcode'),
          t('scanner.invalidBarcodeMessage'),
          [
            { text: t('scanner.scanAgain'), onPress: () => setScanned(false) },
            { text: t('scanner.goBack'), onPress: () => navigation.goBack() }
          ]
        );
        setLoading(false);
        return;
      }

      // Search for the book using the ISBN
      const bookData = await getBookByISBN(cleanedData);
      
      if (bookData) {
        // Navigate to book details or add book screen with the found data
        Alert.alert(
          t('scanner.bookFound'),
          `${t('scanner.bookFound')} "${bookData.title}" ${t('search.byAuthor')} ${bookData.authors.join(', ')}`,
          [
            { 
              text: t('scanner.addToLibrary'), 
              onPress: () => {
                // Navigate to AddBook screen with pre-filled data
                navigation.navigate('AddBook', { bookData });
              }
            },
            { text: t('scanner.scanAnother'), onPress: () => setScanned(false) }
          ]
        );
      } else {
        Alert.alert(
          t('scanner.bookNotFound'),
          t('scanner.bookNotFoundMessage'),
          [
            { 
              text: t('scanner.addManually'), 
              onPress: () => navigation.navigate('AddBook', { isbn: cleanedData })
            },
            { text: t('scanner.scanAgain'), onPress: () => setScanned(false) },
            { text: t('scanner.goBack'), onPress: () => navigation.goBack() }
          ]
        );
      }
    } catch (error) {
      console.error('Error processing scanned barcode:', error);
      Alert.alert(
        t('scanner.error'),
        t('scanner.errorMessage'),
        [
          { 
            text: t('scanner.addManually'), 
            onPress: () => navigation.navigate('AddBook', { isbn: data })
          },
          { text: t('scanner.scanAgain'), onPress: () => setScanned(false) },
          { text: t('scanner.goBack'), onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurface }}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={[styles.permissionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text 
              variant="titleLarge" 
              style={[styles.title, { color: theme.colors.onSurface }]}
            >
              {t('scanner.cameraPermissionTitle')}
            </Text>
            <Text 
              variant="bodyMedium" 
              style={[styles.description, { color: theme.colors.onSurface }]}
            >
              {t('scanner.cameraPermissionMessage')}
            </Text>
            <Button
              mode="contained"
              onPress={requestPermission}
              style={[styles.button, { backgroundColor: theme.colors.primary }]}
            >
              {t('scanner.grantPermission')}
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={[styles.button, { borderColor: theme.colors.outline }]}
              textColor={theme.colors.onSurface}
            >
              {t('scanner.goBack')}
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text 
          variant="titleLarge" 
          style={[styles.headerTitle, { color: theme.colors.onBackground }]}
        >
          {t('scanner.title')}
        </Text>
        <Text 
          variant="bodyMedium" 
          style={[styles.headerDescription, { color: theme.colors.onBackground }]}
        >
          {t('scanner.description')}
        </Text>
      </View>

      <View style={styles.scannerContainer}>
        <CameraView
          style={[StyleSheet.absoluteFillObject, styles.scanner]}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
          }}
        />
        
        {/* Scanner overlay */}
        <View style={styles.overlay}>
          <View style={[styles.scanFrame, { borderColor: theme.colors.primary }]} />
        </View>

        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: 'white' }]}>
              {t('scanner.searching')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {scanned && !loading && (
          <Button
            mode="contained"
            onPress={() => setScanned(false)}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
          >
            {t('scanner.scanAgain')}
          </Button>
        )}
        
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={[styles.button, { borderColor: theme.colors.outline }]}
          textColor={theme.colors.onBackground}
        >
          {t('scanner.cancel')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: scale(20),
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(8),
  },
  headerDescription: {
    textAlign: 'center',
    opacity: 0.7,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
    marginHorizontal: scale(20),
    marginBottom: verticalScale(20),
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  scanner: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: width * 0.7,
    height: width * 0.3,
    borderWidth: 2,
    borderRadius: scale(8),
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: verticalScale(16),
    fontSize: scale(16),
  },
  footer: {
    padding: scale(20),
    gap: verticalScale(12),
  },
  button: {
    marginVertical: verticalScale(4),
  },
  permissionCard: {
    margin: scale(20),
  },
  title: {
    textAlign: 'center',
    marginBottom: verticalScale(16),
    fontWeight: '600',
  },
  description: {
    textAlign: 'center',
    marginBottom: verticalScale(20),
    lineHeight: scale(22),
    opacity: 0.8,
  },
});
