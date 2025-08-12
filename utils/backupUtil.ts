import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Alert, Linking } from 'react-native';

export const exportDatabase = async (dateFormat: string, t: (key: string) => string) => {
  try {
    const dbName = 'RibbonDB.db';
    const dbFilePath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

    const fileInfo = await FileSystem.getInfoAsync(dbFilePath);

    if (!fileInfo.exists) {
      Alert.alert(
        t('settings.exportFailedTitle'),
        t('settings.databaseNotFound'),
        [{ text: 'OK' }],
      );
      return;
    }

    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const formattedDate =
      dateFormat === 'dd-mm-yyyy'
        ? `${day}-${month}-${year}`
        : `${month}-${day}-${year}`;

    const exportDbName = `RibbonDB-${formattedDate}.db`;

    const tempExportPath = `${FileSystem.cacheDirectory}${exportDbName}`;
    await FileSystem.copyAsync({
      from: dbFilePath,
      to: tempExportPath,
    });

    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      Alert.alert(
        t('settings.exportFailedTitle') || 'Export Failed',
        t('settings.sharingNotAvailable') || 'Sharing is not available on this device',
        [{ text: 'OK' }],
      );
      return;
    }

    await Sharing.shareAsync(tempExportPath, {
      mimeType: 'application/x-sqlite3',
      dialogTitle: t('settings.exportDatabaseTitle') || 'Export Ribbon Database',
      UTI: 'public.database',
    });
  } catch (error) {
    console.error('Error exporting database:', error);
    Alert.alert(
      t('settings.exportFailedTitle'),
      t('settings.exportErrorMessage'),
      [{ text: 'OK' }],
    );
  }
};

export const importDatabase = async (t: (key: string) => string) => {
  Alert.alert(
    t('settings.importConfirmTitle'),
    t('settings.importConfirmMessage'),
    [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.confirm'),
        onPress: async () => {
          const dbName = 'RibbonDB.db';
          const dbDirectory = `${FileSystem.documentDirectory}SQLite/`;
          const dbFilePath = `${dbDirectory}${dbName}`;
          const backupDbFilePath = `${dbFilePath}.backup`;

          let documentPickerResult;
          try {
            documentPickerResult = await DocumentPicker.getDocumentAsync({
              type: [
                'application/x-sqlite3',
                'application/octet-stream',
                'application/vnd.sqlite3',
              ],
              copyToCacheDirectory: true,
            });

            if (
              documentPickerResult.canceled ||
              !documentPickerResult.assets ||
              documentPickerResult.assets.length === 0 ||
              !documentPickerResult.assets[0].uri
            ) {
              Alert.alert(
                t('settings.importFailedTitle'),
                t('settings.fileNotSelectedError'),
              );
              return;
            }
          } catch (pickerError) {
            console.error('DocumentPicker error:', pickerError);
            Alert.alert(
              t('settings.importFailedTitle'),
              t('settings.filePickerError'),
            );
            return;
          }

          const sourceUri = documentPickerResult.assets[0].uri;
          let originalDbExists = false;
          let backupSuccessfullyCreated = false;

          try {
            const originalDbInfo = await FileSystem.getInfoAsync(dbFilePath);
            originalDbExists = originalDbInfo.exists;

            if (originalDbExists) {
              await FileSystem.copyAsync({
                from: dbFilePath,
                to: backupDbFilePath,
              });
              backupSuccessfullyCreated = true;
            }

            await FileSystem.deleteAsync(dbFilePath, { idempotent: true });
            await FileSystem.copyAsync({ from: sourceUri, to: dbFilePath });

            Alert.alert(
              t('settings.importSuccessTitle'),
              t('settings.importSuccessMessage'),
              [{ text: 'OK' }],
            );

            if (backupSuccessfullyCreated) {
              await FileSystem.deleteAsync(backupDbFilePath, {
                idempotent: true,
              });
            }
          } catch (error) {
            console.error('Error during database replacement:', error);
            let finalAlertMessage = t('settings.importErrorMessageDefault');

            if (backupSuccessfullyCreated) {
              try {
                await FileSystem.deleteAsync(dbFilePath, {
                  idempotent: true,
                });
                await FileSystem.copyAsync({
                  from: backupDbFilePath,
                  to: dbFilePath,
                });
                finalAlertMessage =
                  t('importFailedRestoreSuccess') ||
                  'Import failed, but your original data has been successfully restored.';
                await FileSystem.deleteAsync(backupDbFilePath, {
                  idempotent: true,
                });
              } catch (restoreError) {
                console.error(
                  'CRITICAL: Error restoring database from backup:',
                  restoreError,
                );
                const baseMsg =
                  t('importFailedRestoreErrorBase') ||
                  'Import failed. CRITICAL: Could not restore original data. Backup may be available at: ';
                finalAlertMessage = baseMsg + backupDbFilePath;
              }
            } else if (originalDbExists) {
              finalAlertMessage =
                t('importFailedOriginalIntact') ||
                'Import failed (error during backup step). Your original data should be intact.';
            } else {
              finalAlertMessage =
                t('importFailedNewFileError') ||
                'Import failed while copying the new database. No prior data existed.';
            }
            Alert.alert(
              t('importFailedTitle') || 'Import Failed',
              finalAlertMessage,
              [{ text: 'OK' }],
            );
          }
        },
      },
    ],
    { cancelable: true },
  );
};
