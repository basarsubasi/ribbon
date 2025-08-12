import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

export const reCacheBookCovers = async (): Promise<{success: boolean, updatedCount: number, errorCount: number}> => {
  try {
    // Open database connection
    const db = await SQLite.openDatabaseAsync('RibbonDB.db');
    
    // Get all books with HTTP cover URLs
    const booksWithHttpCovers = await db.getAllAsync(
      'SELECT book_id, title, cover_url FROM books WHERE cover_url IS NOT NULL AND cover_url LIKE "http%"'
    ) as {book_id: number, title: string, cover_url: string}[];

    if (booksWithHttpCovers.length === 0) {
      return { success: true, updatedCount: 0, errorCount: 0 };
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Create covers directory if it doesn't exist
    const coversDirectory = `${FileSystem.documentDirectory}covers/`;
    await FileSystem.makeDirectoryAsync(coversDirectory, { intermediates: true });

    // Process each book cover
    for (const book of booksWithHttpCovers) {
      try {
        console.log(`Processing cover for: ${book.title}`);
        
        // First, clear the existing cover_path to ensure fresh caching
        await db.runAsync(
          'UPDATE books SET cover_path = NULL WHERE book_id = ?',
          [book.book_id]
        );
        
        // Generate filename from book_id and URL extension
        const urlParts = book.cover_url.split('.');
        const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1] : 'jpg';
        const filename = `cover_${book.book_id}.${extension}`;
        const localPath = `${coversDirectory}${filename}`;

        // Delete existing cached file if it exists
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath);
        }

        // Download the image
        const downloadResult = await FileSystem.downloadAsync(
          book.cover_url,
          localPath
        );

        if (downloadResult.status === 200) {
          // Successfully downloaded, update database
          await db.runAsync(
            'UPDATE books SET cover_path = ? WHERE book_id = ?',
            [localPath, book.book_id]
          );
          updatedCount++;
          console.log(`Successfully cached cover for: ${book.title}`);
        } else {
          console.error(`Failed to download cover for ${book.title}: HTTP ${downloadResult.status}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing cover for ${book.title}:`, error);
        errorCount++;
      }
    }

    await db.closeAsync();
    
    return {
      success: true,
      updatedCount,
      errorCount
    };

  } catch (error) {
    console.error('Error in reCacheBookCovers:', error);
    return {
      success: false,
      updatedCount: 0,
      errorCount: 0
    };
  }
};
