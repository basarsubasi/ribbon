import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  TextInput,
  Button,
  Appbar,
  Surface,
  Chip,
  ActivityIndicator
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { StackNavigationProp } from '@react-navigation/stack';
import { PageLogsStackParamList } from '../../utils/types';
import { useSQLiteContext } from 'expo-sqlite';
import { getCoverImageUri } from '../../utils/imageUtils';
import { FontAwesome } from '@expo/vector-icons';

type LogPagesRouteProp = RouteProp<PageLogsStackParamList, 'LogPages'>;
type LogPagesNavigationProp = StackNavigationProp<PageLogsStackParamList, 'LogPages'>;

interface BookData {
  book_id: number;
  title: string;
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  current_page: number;
  authors: string[];
  categories: string[];
}

export default function LogPages() {
  const { theme } = useTheme();
  const navigation = useNavigation<LogPagesNavigationProp>();
  const route = useRoute<LogPagesRouteProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();

  const { bookId } = route.params;

  const [bookData, setBookData] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBookData();
  }, [bookId]);

  const loadBookData = async () => {
    setLoading(true);
    try {
      const bookResult = await db.getAllAsync<any>(`
        SELECT 
          b.*,
          GROUP_CONCAT(DISTINCT a.name) as authors,
          GROUP_CONCAT(DISTINCT c.name) as categories
        FROM books b
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
        LEFT JOIN book_categories bc ON b.book_id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.category_id
        WHERE b.book_id = ?
        GROUP BY b.book_id
      `, [bookId]);

      if (bookResult.length > 0) {
        const book = bookResult[0];
        setBookData({
          ...book,
          authors: book.authors ? book.authors.split(',') : [],
          categories: book.categories ? book.categories.split(',') : []
        });
        
        // Set default start page to current page + 1
        const nextPage = (book.current_page + 1).toString();
        setStartPage(nextPage);
        setEndPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading book data:', error);
      Alert.alert('Error', 'Failed to load book information');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLog = async () => {
    if (!bookData) return;

    const start = parseInt(startPage);
    const end = parseInt(endPage);

    if (isNaN(start) || isNaN(end)) {
      Alert.alert('Invalid Input', 'Please enter valid page numbers');
      return;
    }

    if (start > end) {
      Alert.alert('Invalid Range', 'Start page cannot be greater than end page');
      return;
    }

    if (end > bookData.number_of_pages) {
      Alert.alert('Invalid Page', `End page cannot exceed ${bookData.number_of_pages} pages`);
      return;
    }

    setSaving(true);
    try {
      const currentDate = new Date().toISOString().slice(0, 10);
      const currentTime = new Date().toLocaleTimeString();
      
      // Insert the log
      await db.runAsync(`
        INSERT INTO page_logs (book_id, start_page, end_page, total_page_read, read_date, read_time, page_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [bookId, start, end, end - start + 1, currentDate, currentTime, notes || null]);

      // Update book's current page
      await db.runAsync(`
        UPDATE books SET current_page = ? WHERE book_id = ?
      `, [end, bookId]);

      Alert.alert(
        'Success!', 
        `Logged reading session: pages ${start}-${end}`,
        [
          { text: 'Log More Pages', onPress: () => {
            setStartPage((end + 1).toString());
            setEndPage((end + 1).toString());
            setNotes('');
            setBookData(prev => prev ? { ...prev, current_page: end } : null);
          }},
          { text: 'Done', onPress: () => navigation.navigate('Calendar') }
        ]
      );
    } catch (error) {
      console.error('Error saving log:', error);
      Alert.alert('Error', 'Failed to save reading log');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
          Loading book details...
        </Text>
      </View>
    );
  }

  if (!bookData) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          Failed to load book information
        </Text>
      </View>
    );
  }

  const progress = (bookData.current_page / bookData.number_of_pages) * 100;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Log Reading Pages" />
      </Appbar.Header>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Book Info Card */}
        <Card style={[styles.bookCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.bookContent}>
            <View style={styles.coverContainer}>
              {getCoverImageUri(bookData.cover_path, bookData.cover_url) ? (
                <Image
                  source={{ uri: getCoverImageUri(bookData.cover_path, bookData.cover_url)! }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <FontAwesome name="book" size={32} color={theme.colors.onSurface} />
                </View>
              )}
            </View>

            <View style={styles.bookInfo}>
              <Text variant="titleMedium" style={[styles.bookTitle, { color: theme.colors.onSurface }]}>
                {bookData.title}
              </Text>
              <Text variant="bodyMedium" style={[styles.bookAuthor, { color: theme.colors.onSurfaceVariant }]}>
                {bookData.authors.join(', ') || 'Unknown Author'}
              </Text>
              
              {bookData.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {bookData.categories.slice(0, 3).map((category, index) => (
                    <Chip
                      key={`${category}-${index}`}
                      style={[styles.categoryChip, { backgroundColor: theme.colors.secondaryContainer }]}
                      textStyle={[styles.categoryChipText, { color: theme.colors.onSecondaryContainer }]}
                      compact
                    >
                      {category}
                    </Chip>
                  ))}
                </View>
              )}

              <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                Current Progress: {bookData.current_page}/{bookData.number_of_pages} pages ({progress.toFixed(1)}%)
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Logging Form */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={[styles.formTitle, { color: theme.colors.onSurface }]}>
            Log Your Reading Session
          </Text>

          <View style={styles.pageInputs}>
            <View style={styles.pageInputContainer}>
              <Text variant="labelMedium" style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
                Start Page
              </Text>
              <TextInput
                mode="outlined"
                value={startPage}
                onChangeText={setStartPage}
                keyboardType="numeric"
                placeholder={`From page ${bookData.current_page + 1}`}
                style={styles.pageInput}
              />
            </View>

            <View style={styles.pageInputContainer}>
              <Text variant="labelMedium" style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
                End Page
              </Text>
              <TextInput
                mode="outlined"
                value={endPage}
                onChangeText={setEndPage}
                keyboardType="numeric"
                placeholder={`To page`}
                style={styles.pageInput}
              />
            </View>
          </View>

          <View style={styles.notesContainer}>
            <Text variant="labelMedium" style={[styles.inputLabel, { color: theme.colors.onSurfaceVariant }]}>
              Notes (Optional)
            </Text>
            <TextInput
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any thoughts or notes about your reading..."
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleSaveLog}
            loading={saving}
            disabled={!startPage || !endPage || saving}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
          >
            {saving ? 'Saving...' : 'Save Reading Log'}
          </Button>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: verticalScale(16),
    fontSize: scale(16),
  },
  errorText: {
    fontSize: scale(16),
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(16),
  },
  bookCard: {
    marginBottom: verticalScale(16),
    borderRadius: scale(12),
  },
  bookContent: {
    flexDirection: 'row',
    padding: scale(16),
  },
  coverContainer: {
    marginRight: scale(16),
  },
  coverImage: {
    width: scale(80),
    height: scale(120),
    borderRadius: scale(8),
  },
  coverPlaceholder: {
    width: scale(80),
    height: scale(120),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(4),
  },
  bookAuthor: {
    marginBottom: verticalScale(8),
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: verticalScale(8),
  },
  categoryChip: {
    marginRight: scale(6),
    marginBottom: scale(4),
  },
  categoryChipText: {
    fontSize: scale(10),
  },
  progressText: {
    fontWeight: '500',
  },
  formContainer: {
    borderRadius: scale(12),
    padding: scale(20),
    elevation: 2,
  },
  formTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(20),
    textAlign: 'center',
  },
  pageInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(20),
  },
  pageInputContainer: {
    flex: 0.48,
  },
  inputLabel: {
    marginBottom: verticalScale(8),
    fontWeight: '500',
  },
  pageInput: {
    backgroundColor: 'transparent',
  },
  notesContainer: {
    marginBottom: verticalScale(24),
  },
  notesInput: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    borderRadius: scale(8),
  },
  saveButtonContent: {
    paddingVertical: verticalScale(8),
  },
});
