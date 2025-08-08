import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

// Standardized storage paths
export const BOOK_COVERS_DIR = `${FileSystem.documentDirectory}book_covers/`;
export const CACHED_COVERS_DIR = `${FileSystem.cacheDirectory}cached_covers/`;

// Image validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * Initialize storage directories
 */
export const initializeImageDirectories = async (): Promise<void> => {
  try {
    await FileSystem.makeDirectoryAsync(BOOK_COVERS_DIR, { intermediates: true });
    await FileSystem.makeDirectoryAsync(CACHED_COVERS_DIR, { intermediates: true });
  } catch (error) {
    console.error('Error creating image directories:', error);
  }
};

/**
 * Validate image file
 */
export const validateImage = async (uri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    
    if (!info.exists) {
      return false;
    }

    // Check file size
    if (info.size && info.size > MAX_FILE_SIZE) {
      Alert.alert('Image Too Large', 'Please select an image smaller than 10MB.');
      return false;
    }

    // Check file format (basic check based on URI)
    const extension = uri.split('.').pop()?.toLowerCase();
    if (extension && !ALLOWED_FORMATS.includes(extension)) {
      Alert.alert('Invalid Format', 'Please select a JPG, PNG, or WebP image.');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating image:', error);
    return false;
  }
};

/**
 * Save local image to standardized book covers directory
 */
export const saveLocalBookCover = async (sourceUri: string, bookId?: number): Promise<string | null> => {
  try {
    if (!await validateImage(sourceUri)) {
      return null;
    }

    await initializeImageDirectories();
    
    const timestamp = Date.now();
    const filename = bookId 
      ? `book_${bookId}_${timestamp}.jpg`
      : `book_temp_${timestamp}.jpg`;
    
    const destinationPath = `${BOOK_COVERS_DIR}${filename}`;
    
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationPath
    });
    
    console.log('Local book cover saved to:', destinationPath);
    return destinationPath;
  } catch (error) {
    console.error('Error saving local book cover:', error);
    return null;
  }
};

/**
 * Download and cache remote image from OpenLibrary
 */
export const cacheRemoteBookCover = async (remoteUrl: string, bookId?: number): Promise<string | null> => {
  try {
    await initializeImageDirectories();
    
    const timestamp = Date.now();
    const filename = bookId 
      ? `cached_book_${bookId}_${timestamp}.jpg`
      : `cached_book_temp_${timestamp}.jpg`;
    
    const destinationPath = `${BOOK_COVERS_DIR}${filename}`;
    
    const downloadResult = await FileSystem.downloadAsync(remoteUrl, destinationPath);
    
    if (downloadResult.status === 200) {
      console.log('Remote book cover cached to:', destinationPath);
      return destinationPath;
    } else {
      console.error('Failed to download remote cover:', downloadResult.status);
      return null;
    }
  } catch (error) {
    console.error('Error caching remote book cover:', error);
    return null;
  }
};

/**
 * Delete old cover image
 */
export const deleteOldCover = async (coverPath: string): Promise<void> => {
  try {
    if (!coverPath) return;
    
    const info = await FileSystem.getInfoAsync(coverPath);
    if (info.exists) {
      await FileSystem.deleteAsync(coverPath);
      console.log('Deleted old cover:', coverPath);
    }
  } catch (error) {
    console.error('Error deleting old cover:', error);
  }
};

/**
 * Clean up unused cover images (call periodically)
 */
export const cleanupUnusedCovers = async (usedCoverPaths: string[]): Promise<void> => {
  try {
    const coversDirInfo = await FileSystem.getInfoAsync(BOOK_COVERS_DIR);
    if (!coversDirInfo.exists) return;
    
    const files = await FileSystem.readDirectoryAsync(BOOK_COVERS_DIR);
    
    for (const filename of files) {
      const fullPath = `${BOOK_COVERS_DIR}${filename}`;
      
      // If this file is not in the used covers list, delete it
      if (!usedCoverPaths.includes(fullPath)) {
        await FileSystem.deleteAsync(fullPath);
        console.log('Cleaned up unused cover:', fullPath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up unused covers:', error);
  }
};

/**
 * Get optimized cover image URI (prioritize local, fallback to remote)
 */
export const getCoverImageUri = (coverPath?: string, coverUrl?: string): string | null => {
  // Prioritize local path
  if (coverPath && !coverPath.startsWith('http')) {
    return coverPath;
  }
  
  // Fallback to remote URL
  if (coverUrl) {
    return coverUrl;
  }
  
  return null;
};

