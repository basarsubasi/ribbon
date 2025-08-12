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

type LogDetailsRouteProp = RouteProp<PageLogsStackParamList, 'LogDetails'>;
type LogDetailsNavigationProp = StackNavigationProp<PageLogsStackParamList, 'LogDetails'>;

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

interface LogData {
  page_log_id: number;
  book_id: number;
  start_page: number;
  end_page: number;
  current_page_after_log: number;
  total_page_read: number;
  read_date: string;
  page_notes?: string;
}

// Format date key (avoids timezone shifting that happens with toISOString)
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function LogDetails() {
  const { theme } = useTheme();
  const navigation = useNavigation<LogDetailsNavigationProp>();
  const route = useRoute<LogDetailsRouteProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();

  const { logId } = route.params;

  const [bookData, setBookData] = useState<BookData | null>(null);
  const [logData, setLogData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());

  useEffect(() => {
    loadLogData();
  }, [logId]);

  const loadLogData = async () => {
    setLoading(true);
    try {
      // Load log data with book information
      const logResult = await db.getAllAsync<any>(`
        SELECT 
          pl.*,
          b.title,
          b.cover_url,
          b.cover_path,
          b.number_of_pages,
          b.current_page,
          b.stars,
          GROUP_CONCAT(DISTINCT a.name) as authors,
          GROUP_CONCAT(DISTINCT c.name) as categories
        FROM page_logs pl
        JOIN books b ON pl.book_id = b.book_id
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
        LEFT JOIN book_categories bc ON b.book_id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.category_id
        WHERE pl.page_log_id = ?
        GROUP BY pl.page_log_id
      `, [logId]);

      if (logResult.length > 0) {
        const log = logResult[0];
        
        // Set log data
        setLogData({
          page_log_id: log.page_log_id,
          book_id: log.book_id,
          start_page: log.start_page,
          end_page: log.end_page,
          current_page_after_log: log.current_page_after_log,
          total_page_read: log.total_page_read,
          read_date: log.read_date,
          page_notes: log.page_notes
        });
        
        // Set book data
        setBookData({
          book_id: log.book_id,
          title: log.title,
          cover_url: log.cover_url,
          cover_path: log.cover_path,
          number_of_pages: log.number_of_pages,
          current_page: log.current_page,
          stars: log.stars,
          authors: log.authors ? log.authors.split(',') : [],
          categories: log.categories ? log.categories.split(',') : []
        });
        
        // Set form values
        setStartPage(log.start_page.toString());
        setEndPage(log.end_page.toString());
        setNotes(log.page_notes || '');
        
        // Parse and set the date
        const [year, month, day] = log.read_date.split('-').map(Number);
        const logDate = new Date(year, month - 1, day);
        setSelectedDate(logDate);
        setPickerMonth(new Date(logDate));
      } else {
        Alert.alert('Error', 'Log entry not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading log data:', error);
      Alert.alert('Error', 'Failed to load log information');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLog = async () => {
    if (!bookData || !logData) return;

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
      
      // Calculate total pages read
      const totalPagesRead = start === 0 ? end - start - 1 : end - start;
      
      // Get current page after log (snapshot)
      const currentPageAfterLog = Math.max(end, bookData.current_page);
      
      // Update the log
      await db.runAsync(`
        UPDATE page_logs 
        SET start_page = ?, 
            end_page = ?, 
            current_page_after_log = ?, 
            total_page_read = ?, 
            read_date = ?, 
            page_notes = ?
        WHERE page_log_id = ?
      `, [start, end, currentPageAfterLog, totalPagesRead, logDate, notes || null, logId]);


    }
    
    
    
    catch (error) {
      console.error('Error updating log:', error);
      Alert.alert('Error', 'Failed to update reading log');
    } finally {
      setSaving(false);
      navigation.navigate('Calendar');

    }
  };

  const handleDeleteLog = async () => {
    if (!logData) return;

    Alert.alert(
      'Delete Reading Log',
      'Are you sure you want to delete this reading session? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await db.runAsync('DELETE FROM page_logs WHERE page_log_id = ?', [logId]);
            } catch (error) {
              console.error('Error deleting log:', error);
              Alert.alert('Error', 'Failed to delete reading log');
            } finally {
              setDeleting(false);
              navigation.goBack();

            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" animating={true} color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onBackground }]}>
          Loading log details...
        </Text>
      </View>
    );
  }

  if (!bookData || !logData) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.Content title="Edit Reading Log" />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Book Card */}
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
              Reading Date
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

        {/* Editing Form */}
        <Surface style={[styles.formContainer, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={[styles.formTitle, { color: theme.colors.onSurface }]}>
            Edit Reading Session
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

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              onPress={handleUpdateLog}
              loading={saving}
              disabled={!startPage || !endPage || saving || deleting}
              style={[styles.updateButton, { backgroundColor: theme.colors.primary }]}
              contentStyle={styles.buttonContent}
              labelStyle={{ color: theme.colors.surface }}
            >
              {saving ? 'Updating...' : 'Update Log'}
            </Button>

            <Button
              mode="contained"
              onPress={handleDeleteLog}
              loading={deleting}
              disabled={saving || deleting}
              style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
              labelStyle={{ color: theme.colors.surface }}
              contentStyle={styles.buttonContent}
            >
              {deleting ? 'Deleting...' : 'Delete Log'}
            </Button>
          </View>
        </Surface>
      </ScrollView>

      {/* Date Picker Modal - copied from LogPages */}
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
                const bg = isToday ? theme.colors.secondaryContainer : 'transparent';
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      { backgroundColor: bg },
                      isSelected && {
                        borderWidth: scale(2),
                        borderColor: isToday ? theme.colors.onSecondaryContainer : theme.colors.primary,
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
                          ? theme.colors.onSecondaryContainer
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
                style={{ flex: 1, marginLeft: scale(8) }}
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
                style={{ flex: 1, marginRight: scale(8) }}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: verticalScale(16),
    fontSize: scale(16),
  },
  content: {
    flex: 1,
  },
  bookCard: {
    marginHorizontal: scale(16),
    marginTop: verticalScale(16),
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
    marginHorizontal: scale(16),
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
    marginHorizontal: scale(16),
    marginBottom: verticalScale(16),
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
  actionButtons: {
    gap: verticalScale(12),
  },
  updateButton: {
    borderRadius: scale(8),
  },
  deleteButton: {
    borderRadius: scale(8),
  },
  buttonContent: {
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
