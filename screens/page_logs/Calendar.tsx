import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions, Image, ScrollView } from 'react-native';
import { Text, Surface, FAB, IconButton, Divider, Modal, Portal, Card, Chip, Button, ProgressBar } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import CalendarIcon from '../../components/CalendarIcon';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { getCoverImageUri } from '../../utils/imageUtils';

interface PageLogItem {
  page_log_id: number;
  book_id: number;
  title: string;
  start_page: number;
  end_page: number;
  current_page_after_log: number;
  total_page_read: number;
  page_notes?: string;
  read_time?: string;
  read_date?: string;
  // Book data
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  current_page: number;
  stars?: number;
  book_type: string;
  year_published?: number;
  authors: string[];
  categories: string[];
}

const { width: screenWidth } = Dimensions.get('window');
const DAYS_TO_SHOW = 7;
const COVER_WIDTH = screenWidth * 0.2;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

// Local date key (avoids timezone shifting that happens with toISOString)
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Calendar() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<any>>();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateStrip, setDateStrip] = useState<Date[]>([]);
  const [logs, setLogs] = useState<PageLogItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [logPresence, setLogPresence] = useState<Record<string, boolean>>({});
  
  // Note modal states
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNoteLog, setCurrentNoteLog] = useState<PageLogItem | null>(null);
  const [bookNotes, setBookNotes] = useState<PageLogItem[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  const buildStrip = useCallback((center: Date) => {
    const days: Date[] = [];
    for (let i = -Math.floor(DAYS_TO_SHOW/2); i <= Math.floor(DAYS_TO_SHOW/2); i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      days.push(d);
    }
    setDateStrip(days);
  }, []);

  const loadLogs = useCallback(async () => {
    const key = formatDateKey(selectedDate);
    setLoading(true);
    try {
      const result = await db.getAllAsync<any>(`
        SELECT 
          pl.*, 
          b.*,
          GROUP_CONCAT(DISTINCT a.name) as authors,
          GROUP_CONCAT(DISTINCT c.name) as categories
        FROM page_logs pl
        JOIN books b ON b.book_id = pl.book_id
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
        LEFT JOIN book_categories bc ON b.book_id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.category_id
        WHERE pl.read_date = ?
        GROUP BY pl.page_log_id
        ORDER BY pl.page_log_id DESC 
      `, [key]);
      
      setLogs(result.map(r => ({
        page_log_id: r.page_log_id,
        book_id: r.book_id,
        title: r.title,
        start_page: r.start_page,
        end_page: r.end_page,
        current_page_after_log: r.current_page_after_log,
        total_page_read: r.total_page_read,
        read_time: r.read_time,
        page_notes: r.page_notes,
        read_date: r.read_date,
        // Book data
        cover_url: r.cover_url,
        cover_path: r.cover_path,
        number_of_pages: r.number_of_pages,
        current_page: r.current_page,
        stars: r.stars,
        book_type: r.book_type,
        year_published: r.year_published,
        authors: r.authors ? r.authors.split(',') : [],
        categories: r.categories ? r.categories.split(',') : []
      })));
    } catch (e) {
      console.warn('Failed loading logs', e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [db, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  useEffect(() => { buildStrip(selectedDate); }, [selectedDate, buildStrip]);

  // Load log presence for visible strip dates
  useEffect(() => {
    const loadPresence = async () => {
      if (!dateStrip.length) return;
      try {
        const keys = dateStrip.map(formatDateKey);
        const placeholders = keys.map(() => '?').join(',');
        const rows = await db.getAllAsync<any>(
          `SELECT read_date, COUNT(*) cnt FROM page_logs WHERE read_date IN (${placeholders}) GROUP BY read_date`,
          keys
        );
        const map: Record<string, boolean> = {};
        rows.forEach(r => { map[r.read_date] = r.cnt > 0; });
        setLogPresence(map);
      } catch (e) {
        console.warn('Failed loading presence', e);
      }
    };
    loadPresence();
  }, [dateStrip, db]);

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
  };

  const handleViewNote = async (log: PageLogItem) => {
    try {
      // Get all notes for this book, ordered by date
      const result = await db.getAllAsync<any>(`
        SELECT 
          pl.*, 
          b.title,
          b.number_of_pages
        FROM page_logs pl
        JOIN books b ON b.book_id = pl.book_id
        WHERE pl.book_id = ? AND pl.page_notes IS NOT NULL AND pl.page_notes != ''
        ORDER BY pl.read_date ASC, pl.page_log_id ASC
      `, [log.book_id]);

      const notes = result.map(r => ({
        ...log, // Keep the current log's book data
        page_log_id: r.page_log_id,
        start_page: r.start_page,
        end_page: r.end_page,
        current_page_after_log: r.current_page_after_log,
        total_page_read: r.total_page_read,
        read_time: r.read_time,
        page_notes: r.page_notes,
        // Keep title and number_of_pages from the query
        title: r.title,
        number_of_pages: r.number_of_pages,
        // Add read_date for display
        read_date: r.read_date
      }));

      setBookNotes(notes);
      const currentIndex = notes.findIndex(note => note.page_log_id === log.page_log_id);
      setCurrentNoteIndex(Math.max(0, currentIndex));
      setCurrentNoteLog(log);
      setShowNoteModal(true);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const renderDay = ({ item }: { item: Date }) => {
    const key = formatDateKey(item);
    const isSelected = key === formatDateKey(selectedDate);
    const todayFlag = isToday(item);
    const hasLogs = !!logPresence[key];
    const baseBg = hasLogs
      ? theme.colors.primary
      : todayFlag
        ? (theme.colors.secondaryContainer || theme.colors.primaryContainer)
        : 'transparent';
    
    return (
      <TouchableOpacity 
        onPress={() => {
          // Only rebuild strip if the selected date is not in the current visible strip
          const currentStripKeys = dateStrip.map(d => formatDateKey(d));
          const selectedKey = formatDateKey(item);
          
          if (!currentStripKeys.includes(selectedKey)) {
            buildStrip(item);
          }
          
          setSelectedDate(item);
        }} 
        style={[
          styles.dayItem,
          { backgroundColor: baseBg },
          isSelected && {
            borderWidth: scale(2),
            borderColor: hasLogs 
              ? theme.colors.onPrimary 
              : todayFlag
                ? theme.colors.primary
                : theme.colors.secondaryContainer
          }
        ]}
        activeOpacity={0.8}
      >        
        <Text style={[
          styles.dayDow, 
          { 
            color: hasLogs
              ? theme.colors.onPrimary
              : todayFlag
                ? (theme.colors.onSecondaryContainer || theme.colors.onPrimaryContainer)
                : theme.colors.onSurfaceVariant 
          }
        ]}>
          {item.toLocaleDateString(undefined, { weekday: 'short' })}
        </Text>
        <Text style={[
          styles.dayNum, 
          { 
            color: hasLogs
              ? theme.colors.onPrimary
              : todayFlag
                ? (theme.colors.onSecondaryContainer || theme.colors.onPrimaryContainer)
                : theme.colors.onSurface 
          }
        ]}>
          {item.getDate()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderLogCard = ({ item }: { item: PageLogItem }) => {
    // Use current_page_after_log for progress calculation (snapshot at log time)
    const completion = item.current_page_after_log / item.number_of_pages;
    const completionText = `${Math.round(completion * 100)}%`;
    
    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('LogDetails', { 
          logId: item.page_log_id,
          bookId: item.book_id 
        })} 
        activeOpacity={0.7}
      >
        <Card style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content style={styles.bookContent}>
            {/* Book Cover */}
            <View style={styles.coverContainer}>
              {getCoverImageUri(item.cover_path, item.cover_url) ? (
                <Image 
                  source={{ uri: getCoverImageUri(item.cover_path, item.cover_url)! }} 
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <FontAwesome name="book" size={24} color={theme.colors.onSurface} />
                </View>
              )}
            </View>
            
            {/* Book Info */}
            <View style={styles.bookInfo}>
              <View style={styles.titleRow}>
                <Text 
                  variant="titleMedium" 
                  style={[styles.bookTitle, { color: theme.colors.onSurface }]}
                  numberOfLines={2}
                >
                  {item.title}
                  {item.year_published && (
                    <Text 
                      variant="bodySmall" 
                      style={[styles.yearInTitle, { color: theme.colors.onSurfaceVariant }]}
                    >
                      {' '}({item.year_published})
                    </Text>
                  )}
                </Text>
              </View>
              
              <Text 
                variant="bodyMedium" 
                style={[styles.bookAuthor, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {item.authors.join(', ') || 'Unknown Author'}
              </Text>
              
              {/* Stars Rating */}
              {item.stars && item.stars > 0 && (
                <View style={styles.starsContainer}>
                  {[...Array(item.stars)].map((_, index) => (
                    <Text key={index} style={[styles.star, { color: theme.colors.primary }]}>
                      ★
                    </Text>
                  ))}
                </View>
              )}
              
              {/* Categories - all using secondaryContainer color */}
              {item.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {item.categories.slice(0, 2).map((category, index) => (
                    <Chip
                      key={`${category}-${index}`}
                      style={[
                        styles.categoryChip, 
                        { backgroundColor: theme.colors.secondaryContainer }
                      ]}
                      textStyle={[styles.categoryChipText, { color: theme.colors.onSecondaryContainer }]}
                      compact
                    >
                      {category.length > 15 ? `${category.substring(0, 15)}...` : category}
                    </Chip>
                  ))}
                  {item.categories.length > 2 && (
                    <Text style={[styles.moreCategories, { color: theme.colors.onSurfaceVariant }]}>
                      +{item.categories.length - 2} more
                    </Text>
                  )}
                </View>
              )}
              
              {/* Log info chips - moved below categories */}
              <View style={styles.logInfoContainer}>
                <Chip 
                  compact
                  textStyle={styles.logChipText}
                  style={[styles.logChip, { backgroundColor: theme.colors.primaryContainer }]}
                >
                  Pages {item.start_page}–{item.end_page}
                </Chip>
                <Chip 
                  compact
                  textStyle={styles.logChipText}
                  style={[styles.logChip, { backgroundColor: theme.colors.primaryContainer }]}
                >
                  {item.total_page_read} pages
                </Chip>
                {item.read_time && (
                  <Chip 
                    compact
                    textStyle={styles.timeChipText}
                    style={[styles.timeChip, { backgroundColor: theme.colors.tertiaryContainer }]}
                  >
                    {item.read_time}
                  </Chip>
                )}
                {/* Note button - only show if log has notes */}
                {item.page_notes && item.page_notes.trim() && (
                  <IconButton
                    icon="note-text"
                    size={20}
                    iconColor={theme.colors.primary}
                    style={[styles.noteButton, { backgroundColor: theme.colors.primaryContainer }]}
                    onPress={() => handleViewNote(item)}
                  />
                )}
              </View>
              
              {/* Progress Bar - using current_page_after_log for snapshot */}
              <View style={styles.progressContainer}>
                <ProgressBar 
                  progress={completion}
                  color={theme.colors.primary}
                  style={styles.progressBar}
                />
                <Text 
                  variant="bodySmall" 
                  style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}
                >
                  {completionText}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerContent}>
          <CalendarIcon 
            width={scale(28)} 
            height={scale(28)} 
            primaryColor={theme.colors.primary} 
            accentColor={theme.colors.onSurface}
          />
          <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.primary }]}>
            calendar
          </Text>
        </View>
      </View>



      {/* Date Navigation Strip */}
      <Surface style={[styles.stripContainer, { backgroundColor: theme.colors.background }]} elevation={0}>
        <View style={styles.monthSection}>
          <Text variant="labelLarge" style={[styles.monthText, { color: theme.colors.onSurface }]}>
            {selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity 
            style={[styles.jumpButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setPickerMonth(new Date(selectedDate));
              setShowPicker(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={18} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.datesContainer}>
          <FlatList
            data={dateStrip}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => formatDateKey(item)}
            renderItem={renderDay}
            style={styles.dateList}
            contentContainerStyle={styles.dateListContent}
          />
        </View>
      </Surface>

      <Divider />

      {/* Reading Logs */}
      <FlatList
        showsVerticalScrollIndicator={false}
        data={logs}
        keyExtractor={item => `${item.page_log_id}`}
        renderItem={renderLogCard}
        style={styles.logList}
        contentContainerStyle={[
          styles.logListContent, 
          logs.length === 0 && styles.emptyListContent
        ]}
        refreshing={loading}
        onRefresh={loadLogs}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text variant="bodyLarge" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No reading sessions on this day
            </Text>
            <Text variant="bodySmall" style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
              Start reading!
            </Text>
          </View>
        )}
      />

      {/* Floating Action Button */}
      <FAB
        icon="book-plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('ChooseBook', { 
          selectedDate: selectedDate.toISOString().split('T')[0] 
        })}
        mode="elevated"
        color={theme.colors.surface}
      />

      {/* Date Picker Modal */}
      <Portal>
        <Modal 
          visible={showPicker} 
          onDismiss={() => setShowPicker(false)}
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
                const hasLogs = !!logPresence[key];
                const bg = hasLogs
                  ? theme.colors.primaryContainer
                  : isToday
                    ? theme.colors.secondaryContainer
                    : 'transparent';

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      { backgroundColor: bg },
                      isSelected && {
                        borderWidth: scale(2),
                        borderColor: hasLogs ? theme.colors.onPrimary : theme.colors.primary,
                        borderRadius: scale(8),
                      }
                    ]}
                    onPress={() => {
                      setSelectedDate(currentDate);
                      buildStrip(currentDate);
                      setShowPicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: hasLogs
                          ? theme.colors.onPrimary
                          : isToday
                            ? theme.colors.onSecondaryContainer
                            : isCurrentMonth
                              ? theme.colors.onSurface
                              : theme.colors.onSurfaceVariant,
                        opacity: isCurrentMonth ? 1 : 0.4,
                        fontWeight: (isSelected || isToday || hasLogs) ? '600' : '400',
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
                onPress={() => setShowPicker(false)}
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
                  buildStrip(today);
                  setShowPicker(false);
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

      {/* Note Modal */}
      <Portal>
        <Modal 
          visible={showNoteModal} 
          onDismiss={() => setShowNoteModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={[styles.modalSurface, { backgroundColor: theme.colors.surface }]} elevation={3}>
            {currentNoteLog && bookNotes.length > 0 && (
              <>
                <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                  {currentNoteLog.title}
                </Text>
                <Text variant="bodyMedium" style={[styles.modalSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {bookNotes[currentNoteIndex]?.read_date ? 
                    new Date(bookNotes[currentNoteIndex].read_date).toLocaleDateString(undefined, { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 'Unknown Date'
                  }
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.noteContent}>
                  <Text variant="bodyLarge" style={[styles.noteText, { color: theme.colors.onSurface }]}>
                    {bookNotes[currentNoteIndex]?.page_notes || 'No note available'}
                  </Text>
                </ScrollView>
                
                {/* Navigation arrows - always show, but grey out when disabled */}
                <View style={styles.noteNavigation}>
                  <IconButton
                    icon="chevron-left"
                    size={24}
                    iconColor={bookNotes.length > 1 && currentNoteIndex > 0 ? theme.colors.onSurface : theme.colors.outline}
                    disabled={bookNotes.length <= 1 || currentNoteIndex === 0}
                    onPress={() => setCurrentNoteIndex(prev => Math.max(0, prev - 1))}
                    style={{ opacity: (bookNotes.length > 1 && currentNoteIndex > 0) ? 1 : 0.3 }}
                  />
                  
                  <Text variant="bodyMedium" style={[styles.navigationText, { color: theme.colors.onSurface }]}>
                    {bookNotes[currentNoteIndex]?.start_page} - {bookNotes[currentNoteIndex]?.end_page}
                  </Text>
                  
                  <IconButton
                    icon="chevron-right"
                    size={24}
                    iconColor={bookNotes.length > 1 && currentNoteIndex < bookNotes.length - 1 ? theme.colors.onSurface : theme.colors.outline}
                    disabled={bookNotes.length <= 1 || currentNoteIndex === bookNotes.length - 1}
                    onPress={() => setCurrentNoteIndex(prev => Math.min(bookNotes.length - 1, prev + 1))}
                    style={{ opacity: (bookNotes.length > 1 && currentNoteIndex < bookNotes.length - 1) ? 1 : 0.3 }}
                  />
                </View>
                
                <Button 
                  mode="outlined" 
                  onPress={() => setShowNoteModal(false)}
                  style={{ marginTop: verticalScale(16) }}
                  labelStyle={{ color: theme.colors.onSurface }}
                >
                  Close
                </Button>
              </>
            )}
          </Surface>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: scale(12),
    fontWeight: '300',
    letterSpacing: scale(1),
    textTransform: 'lowercase',
  },
  stripContainer: {
    flexDirection: 'column',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(8),
  },
  navButton: {
    marginHorizontal: scale(4),
  },
  jumpButton: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(50),
  },
  monthSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(8),
    flexDirection: 'row',
    marginBottom: verticalScale(8),
  },
  monthText: {
    fontWeight: '600',
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: scale(0.5),
  },
  datesContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: verticalScale(16),
    paddingHorizontal: scale(8),
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
  dateList: {
    flexGrow: 1,
  },
  dateListContent: {
    paddingHorizontal: scale(8),
  },
  dayItem: {
    minWidth: scale(55),
    height: scale(55),
    borderRadius: scale(12),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(3),
    position: 'relative',
  },
  dayDow: { 
    fontSize: scale(10), 
    fontWeight: '600',
    marginBottom: scale(2),
  },
  dayNum: { 
    fontSize: scale(16), 
    fontWeight: '700' 
  },
  todayDot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    position: 'absolute',
    bottom: scale(6),
  },
  logList: {
    flex: 1,
  },
  logListContent: {
    padding: scale(16),
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(40),
  },
  emptyText: {
    marginTop: verticalScale(16),
    textAlign: 'center',
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: verticalScale(4),
    textAlign: 'center',
    opacity: 0.7,
  },
  // Library-style book card styles
  bookCard: {
    marginBottom: scale(16),
  },
  bookContent: {
    flexDirection: 'row',
    padding: scale(16),
  },
  coverContainer: {
    marginRight: scale(12),
  },
  coverImage: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(4),
  },
  coverPlaceholder: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(4),
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontWeight: '600',
    marginBottom: scale(4),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    marginBottom: scale(4),
  },
  yearInTitle: {
    marginLeft: scale(6),
    flexShrink: 0,
  },
  bookAuthor: {
    marginBottom: scale(8),
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  star: {
    fontSize: scale(16),
    marginRight: scale(2),
  },
  logInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: scale(8),
    gap: scale(6),
  },
  logChip: {
    height: scale(28),
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
  },
  logChipText: {
    fontSize: scale(11),
    lineHeight: scale(14),
  },
  timeChip: {
    height: scale(28),
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
  },
  timeChipText: {
    fontSize: scale(11),
    lineHeight: scale(14),
    fontWeight: '600',
  },
  categoriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: scale(8),
    gap: scale(6),
  },
  categoryChip: {
    height: scale(28),
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
    marginBottom: scale(2),
  },
  categoryChipText: {
    fontSize: scale(11),
    lineHeight: scale(14),
  },
  moreCategories: {
    fontSize: scale(11),
    fontStyle: 'italic',
    marginTop: scale(2),
  },
  notePreview: {
    marginTop: verticalScale(4),
    marginBottom: verticalScale(6),
    fontStyle: 'italic',
    lineHeight: scale(16),
  },
  progressContainer: {
    marginTop: scale(8),
    marginBottom: scale(1),
  },
  progressBar: {
    height: scale(6),
    borderRadius: scale(3),
    marginBottom: scale(1),
  },
  progressText: {
    fontSize: scale(12),
    textAlign: 'right',
  },
  // Modal styles
  fab: {
    position: 'absolute',
    bottom: verticalScale(20),
    right: scale(20),
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
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: verticalScale(20),
  },
  quickDateBtn: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(60),
  },
  noteButton: {
    marginLeft: scale(4),
    width: scale(32),
    height: scale(32),
  },
  // Modal note styles
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: verticalScale(16),
    fontWeight: '500',
  },
  noteContent: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: scale(8),
    padding: scale(16),
    marginVertical: verticalScale(16),
    minHeight: scale(80),
    maxHeight: verticalScale(300), // Add max height for scrolling
  },
  noteText: {
    lineHeight: scale(22),
  },
  noteNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(12),
  },
  navigationText: {
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  modalCloseBtn: {
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
