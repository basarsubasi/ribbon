import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Alert, TouchableOpacity } from 'react-native';
import {
  Text,
  Card,
  TextInput,
  Button,
  Appbar,
  Surface,
  Chip,
  ActivityIndicator,
  Modal,
  Portal
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { StackNavigationProp } from '@react-navigation/stack';
import { PageLogsStackParamList } from '../../utils/types';
import { useSQLiteContext } from 'expo-sqlite';
import { getCoverImageUri } from '../../utils/imageUtils';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

type LogPagesRouteProp = RouteProp<PageLogsStackParamList, 'LogPages'>;
type LogPagesNavigationProp = StackNavigationProp<PageLogsStackParamList, 'LogPages'>;

interface BookData {
  book_id: number;
  title: string;
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  current_page: number;
  stars?: number;
  authors: string[];
  categories: string[];
}

// Format date key (avoids timezone shifting that happens with toISOString)
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function LogPages() {
  const { theme } = useTheme();
  const navigation = useNavigation<LogPagesNavigationProp>();
  const route = useRoute<LogPagesRouteProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();

  const { bookId, selectedDate: routeSelectedDate } = route.params;

  const [bookData, setBookData] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    routeSelectedDate ? new Date(routeSelectedDate) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(
    routeSelectedDate ? new Date(routeSelectedDate) : new Date()
  );

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
        
        // Set default start page to current page (not current page + 1)
        setStartPage(book.current_page.toString());
        // Leave end page empty initially
        setEndPage('');
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

    // Validation checks
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
      const logDate = formatDateKey(selectedDate);
      const currentTime = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Calculate total pages read
      const totalPagesRead = end - start + 1;
      
      // Get current page after log (snapshot)
      const currentPageAfterLog = Math.max(end, bookData.current_page);
      
      // Insert the log
      await db.runAsync(`
        INSERT INTO page_logs (
          book_id, 
          start_page, 
          end_page, 
          current_page_after_log, 
          total_page_read, 
          read_date, 
          page_notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [bookId, start, end, currentPageAfterLog, totalPagesRead, logDate, notes || null]);

      // Update book's current page only if end page > current page
      let updateQuery = '';
      let updateParams = [];
      
      if (end > bookData.current_page) {
        // Update both current_page and last_read conditionally
        updateQuery = `
          UPDATE books 
          SET current_page = ?, 
              last_read = CASE 
                WHEN last_read IS NULL OR last_read < ? THEN ?
                ELSE last_read
              END
          WHERE book_id = ?
        `;
        updateParams = [end, logDate, logDate, bookId];
      } else {
        // Only update last_read conditionally
        updateQuery = `
          UPDATE books 
          SET last_read = CASE 
            WHEN last_read IS NULL OR last_read < ? THEN ?
            ELSE last_read
          END
          WHERE book_id = ?
        `;
        updateParams = [logDate, logDate, bookId];
      }
      
      await db.runAsync(updateQuery, updateParams);

    } catch (error) {
      console.error('Error saving log:', error);
      Alert.alert('Error', 'Failed to save reading log');
    } finally {
      setSaving(false);
      navigation.navigate('Calendar');
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
              
              {/* Stars Display */}
              {bookData.stars && bookData.stars > 0 && (
                <View style={styles.starsContainer}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Text key={index} style={[styles.star, { color: theme.colors.primary }]}>
                      {index < bookData.stars! ? '★' : '☆'}
                    </Text>
                  ))}
                </View>
              )}
              
              {bookData.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {bookData.categories.slice(0, 3).map((category, index) => {
                    return (
                      <Chip
                        key={`${category}-${index}`}
                        style={[
                          styles.categoryChip, 
                          { backgroundColor: theme.colors.secondaryContainer }
                        ]}
                        textStyle={[styles.categoryChipText, { color: theme.colors.onSecondaryContainer }]}
                        compact
                      >
                        {category}
                      </Chip>
                    );
                  })}
                </View>
              )}

              <Text variant="bodySmall" style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}>
                Current Progress: {bookData.current_page}/{bookData.number_of_pages} pages
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Date Selection Card */}
        <Card style={[styles.dateCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.dateCardContent}>
            <Text variant="titleMedium" style={[styles.dateCardTitle, { color: theme.colors.onSurface }]}>
              Logging Date
            </Text>
            <View style={styles.dateSection}>
              <Text variant="bodyLarge" style={[styles.selectedDateText, { color: theme.colors.onSurface }]}>
                {selectedDate.toLocaleDateString(undefined, { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
              <TouchableOpacity
                style={[styles.datePickerButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  setPickerMonth(new Date(selectedDate));
                  setShowDatePicker(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar" size={18} color={theme.colors.surface} />
              </TouchableOpacity>
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
              <TextInput
                mode="outlined"
                label="Start Page"
                value={startPage}
                onChangeText={setStartPage}
                keyboardType="numeric"
                style={styles.pageInput}
              />
            </View>

            <View style={styles.pageInputContainer}>
              <TextInput
                mode="outlined"
                label="End Page"
                value={endPage}
                onChangeText={setEndPage}
                keyboardType="numeric"
                style={styles.pageInput}
              />
            </View>
          </View>

          <View style={styles.notesContainer}>
            <TextInput
              mode="outlined"
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={6}
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

      {/* Date Picker Modal */}
      <Portal>
        <Modal 
          visible={showDatePicker} 
          onDismiss={() => setShowDatePicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={[styles.modalSurface, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Select Date
            </Text>
            
            {/* Month Navigation */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity
                style={[styles.monthNavButton, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  const newMonth = new Date(pickerMonth);
                  newMonth.setMonth(pickerMonth.getMonth() - 1);
                  setPickerMonth(newMonth);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600', fontSize: scale(16) }}>‹</Text>
              </TouchableOpacity>
              
              <Text variant="titleMedium" style={[styles.monthYearText, { color: theme.colors.onSurface }]}>
                {pickerMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              
              <TouchableOpacity
                style={[styles.monthNavButton, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  const newMonth = new Date(pickerMonth);
                  newMonth.setMonth(pickerMonth.getMonth() + 1);
                  setPickerMonth(newMonth);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600', fontSize: scale(16) }}>›</Text>
              </TouchableOpacity>
            </View>
            
            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {Array.from({ length: 42 }, (_, index) => {
                const startOfMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1);
                const startOfWeek = new Date(startOfMonth);
                startOfWeek.setDate(startOfMonth.getDate() - startOfMonth.getDay());
                
                const currentDate = new Date(startOfWeek);
                currentDate.setDate(startOfWeek.getDate() + index);
                
                const isCurrentMonth = currentDate.getMonth() === pickerMonth.getMonth();
                const key = formatDateKey(currentDate);
                const isSelected = key === formatDateKey(selectedDate);
                const isToday = key === formatDateKey(new Date());
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      isToday && { backgroundColor: theme.colors.secondaryContainer || theme.colors.primaryContainer },
                      isSelected && {
                        borderWidth: scale(2),
                        borderColor: theme.colors.primary,
                        borderRadius: scale(8),
                      }
                    ]}
                    onPress={() => {
                      setSelectedDate(currentDate);
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: isToday
                          ? (theme.colors.onSecondaryContainer || theme.colors.onPrimaryContainer)
                          : isCurrentMonth
                            ? theme.colors.onSurface
                            : theme.colors.onSurfaceVariant,
                        opacity: isCurrentMonth ? 1 : 0.4,
                        fontWeight: (isSelected || isToday) ? '600' : '400',
                      }}
                    >
                      {currentDate.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={styles.modalActions}>
              <Button 
                mode="outlined" 
                onPress={() => setShowDatePicker(false)}
                style={{ flex: 1, marginRight: scale(8) }}
                labelStyle={{ color: theme.colors.onSurface }}
              >
                Cancel
              </Button>

              <Button 
                mode="contained" 
                onPress={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  setShowDatePicker(false);
                }}
                style={{ flex: 1, marginLeft: scale(8) }}
                labelStyle={{ color: theme.colors.surface }}
              >
                Today
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>
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
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  star: {
    fontSize: scale(16),
    marginRight: scale(2),
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: verticalScale(8),
    gap: scale(6),
  },
  categoryChip: {
    height: scale(28),
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
  },
  categoryChipText: {
    fontSize: scale(11),
    lineHeight: scale(14),
  },
  progressText: {
    fontWeight: '500',
  },
  dateCard: {
    marginBottom: verticalScale(16),
    borderRadius: scale(12),
  },
  dateCardContent: {
    padding: scale(16),
  },
  dateCardTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(12),
    textAlign: 'center',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedDateText: {
    flex: 1,
    fontWeight: '500',
  },
  datePickerButton: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(50),
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
  pageInput: {
    backgroundColor: 'transparent',
  },
  notesContainer: {
    marginBottom: verticalScale(24),
  },
  notesInput: {
    backgroundColor: 'transparent',
    minHeight: verticalScale(120),
  },
  saveButton: {
    borderRadius: scale(8),
  },
  saveButtonContent: {
    paddingVertical: verticalScale(8),
  },
  modalContainer: {
    margin: scale(20),
  },
  modalSurface: {
    borderRadius: scale(16),
    padding: scale(20),
  },
  modalTitle: {
    marginBottom: verticalScale(20),
    textAlign: 'center',
    fontWeight: '600',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  monthNavButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: verticalScale(16),
    paddingHorizontal: scale(8),
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale(8),
    marginBottom: scale(4),
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: verticalScale(16),
    gap: scale(8),
  },
});
