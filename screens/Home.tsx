
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Image, TouchableOpacity } from 'react-native';
import {
  Text,
  Card,
  Button,
  Surface,
  Divider,
  ProgressBar,
  Chip,
  IconButton,
  Modal,
  Portal,
} from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import BookIcon from '../components/BookIcon';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSQLiteContext } from 'expo-sqlite';
import { getCoverImageUri } from '../utils/imageUtils';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { PageLogsStackParamList } from '../utils/types';


const { width } = Dimensions.get('window');

// Define the tab navigator param list
type TabParamList = {
  Home: undefined;
  LibraryStack: undefined;
  PageLogsStack: undefined;
  Stats: undefined;
  Settings: undefined;
};

// Define the navigation type for Home screen
type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<PageLogsStackParamList>
>;

interface BookInProgress {
  book_id: number;
  title: string;
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  current_page: number;
  authors: string[];
  categories: string[];
  stars?: number;
  year_published?: number;
  last_read?: string;
  latest_log_id: number;
  has_notes: number;
}

interface ReadingStats {
  totalBooks: number;
  currentlyReading: number;
  pagesReadToday: number;
  pagesReadThisWeek: number;
  readingStreak: number;
  finishedBooks: number;
}


const Home = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  
  const [stats, setStats] = useState<ReadingStats>({
    totalBooks: 0,
    currentlyReading: 0,
    pagesReadToday: 0,
    pagesReadThisWeek: 0,
    readingStreak: 0,
    finishedBooks: 0,
  });
  const [booksInProgress, setBooksInProgress] = useState<BookInProgress[]>([]);
  const [loading, setLoading] = useState(true);

  // Note modal states
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNoteLog, setCurrentNoteLog] = useState<any>(null);
  const [bookNotes, setBookNotes] = useState<any[]>([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

  // Format date key for today and week calculations
  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const loadBooksInProgress = async () => {
    try {
      const books = await db.getAllAsync<any>(`
        SELECT 
          b.book_id,
          b.title,
          b.cover_url,
          b.cover_path,
          b.number_of_pages,
          b.current_page,
          b.stars,
          b.year_published,
          b.last_read,
          GROUP_CONCAT(DISTINCT a.name) as authors,
          GROUP_CONCAT(DISTINCT c.name) as categories,
          COALESCE(MAX(pl.page_log_id), 0) as latest_log_id,
          CASE WHEN EXISTS(
            SELECT 1 FROM page_logs pl2 
            WHERE pl2.book_id = b.book_id 
            AND pl2.page_notes IS NOT NULL 
            AND pl2.page_notes != ''
          ) THEN 1 ELSE 0 END as has_notes
        FROM books b
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
        LEFT JOIN book_categories bc ON b.book_id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.category_id
        LEFT JOIN page_logs pl ON b.book_id = pl.book_id 
        WHERE b.current_page > 0 AND b.current_page < b.number_of_pages
        GROUP BY b.book_id
        ORDER BY 
          b.last_read DESC NULLS LAST,
          latest_log_id DESC,
          b.date_added DESC
        LIMIT 10
      `);

      const processedBooks = books.map(book => ({
        ...book,
        authors: book.authors ? book.authors.split(',') : [],
        categories: book.categories ? book.categories.split(',') : []
      }));

      setBooksInProgress(processedBooks);
    } catch (error) {
      console.error('Error loading books in progress:', error);
    }
  };

  const loadReadingStats = async () => {
    try {
      // Get total books count
      const totalBooksResult = await db.getAllAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM books
      `);
      const totalBooks = totalBooksResult[0]?.count || 0;

      // Get currently reading books (progress between 0 and 100%)
      const currentlyReadingResult = await db.getAllAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM books 
        WHERE current_page > 0 AND current_page < number_of_pages
      `);
      const currentlyReading = currentlyReadingResult[0]?.count || 0;

      // Get pages read today
      const today = formatDateKey(new Date());
      const pagesTodayResult = await db.getAllAsync<{ total: number }>(`
        SELECT COALESCE(SUM(total_page_read), 0) as total 
        FROM page_logs 
        WHERE read_date = ?
      `, [today]);
      const pagesReadToday = pagesTodayResult[0]?.total || 0;

      // Get pages read this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const weekAgoKey = formatDateKey(oneWeekAgo);
      
      const pagesThisWeekResult = await db.getAllAsync<{ total: number }>(`
        SELECT COALESCE(SUM(total_page_read), 0) as total 
        FROM page_logs 
        WHERE read_date >= ?
      `, [weekAgoKey]);
      const pagesReadThisWeek = pagesThisWeekResult[0]?.total || 0;

      // Calculate reading streak (consecutive days with reading)
      let streak = 0;
      let currentDate = new Date();
      
      while (true) {
        const dateKey = formatDateKey(currentDate);
        const hasReading = await db.getAllAsync<{ count: number }>(`
          SELECT COUNT(*) as count 
          FROM page_logs 
          WHERE read_date = ?
        `, [dateKey]);
        
        if (hasReading[0]?.count > 0) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          // If today has no reading, don't count it against the streak
          if (dateKey === today && streak === 0) {
            currentDate.setDate(currentDate.getDate() - 1);
            continue;
          }
          break;
        }
        
        // Prevent infinite loop
        if (streak > 9999) break;
      }

      // Get finished books count (books where current_page = number_of_pages)
      const finishedBooksResult = await db.getAllAsync<{ count: number }>(`
        SELECT COUNT(*) as count FROM books 
        WHERE current_page >= number_of_pages AND number_of_pages > 0
      `);
      const finishedBooks = finishedBooksResult[0]?.count || 0;

      setStats({
        totalBooks,
        currentlyReading,
        pagesReadToday,
        pagesReadThisWeek,
        readingStreak: streak,
        finishedBooks,
      });
    } catch (error) {
      console.error('Error loading reading stats:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        await Promise.all([loadBooksInProgress(), loadReadingStats()]);
        setLoading(false);
      };
      
      loadData();
    }, [])
  );

  const handleViewNote = async (book: BookInProgress) => {
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
      `, [book.book_id]);

      const notes = result.map(r => ({
        ...r,
        // Add read_date for display
        read_date: r.read_date
      }));

      setBookNotes(notes);
      // Find the latest note (from latest_log_id) or default to last one
      const currentIndex = notes.findIndex(note => note.page_log_id === book.latest_log_id);
      setCurrentNoteIndex(Math.max(0, currentIndex >= 0 ? currentIndex : notes.length - 1));
      setCurrentNoteLog(book);
      setShowNoteModal(true);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const renderBookCard = (book: BookInProgress) => {
    const completion = book.current_page / book.number_of_pages;
    const completionText = `${Math.round(completion * 100)}%`;

    return (
      <TouchableOpacity
        key={book.book_id}
        onPress={() => {
          // Navigate to PageLogs with book ID and today's date
          (navigation as any).navigate('PageLogsStack', {
            screen: 'LogPages',
            params: { bookId: book.book_id, selectedDate: new Date().toISOString().split('T')[0] },

          });
        }}
        activeOpacity={0.7}
      >
        <Card style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content style={styles.bookContent}>
            {/* Book Cover */}
            <View style={styles.coverContainer}>
              {getCoverImageUri(book.cover_path, book.cover_url) ? (
                <Image 
                  source={{ uri: getCoverImageUri(book.cover_path, book.cover_url)! }} 
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <FontAwesome name="book" size={20} color={theme.colors.onSurface} />
                </View>
              )}
            </View>
            
            {/* Book Info */}
            <View style={styles.bookInfo}>
              <Text 
                variant="titleSmall" 
                style={[styles.bookTitle, { color: theme.colors.onSurface }]}
                numberOfLines={2}
              >
                {book.title}
                {book.year_published && (
                  <Text 
                    variant="bodySmall" 
                    style={[styles.yearInTitle, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {' '}({book.year_published})
                  </Text>
                )}
              </Text>
              
              <Text 
                variant="bodySmall" 
                style={[styles.bookAuthor, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {book.authors.join(', ') || 'Unknown Author'}
              </Text>

              {/* Stars Rating */}
              {book.stars && book.stars > 0 && (
                <View style={styles.starsContainer}>
                  {[...Array(book.stars)].map((_, index) => (
                    <Text key={index} style={[styles.star, { color: theme.colors.primary }]}>
                      ★
                    </Text>
                  ))}
                </View>
              )}

              {/* Categories */}
              {book.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {book.categories.slice(0, 2).map((category, index) => (
                    <Chip
                      key={`${category}-${index}`}
                      style={[
                        styles.categoryChip, 
                        { backgroundColor: theme.colors.secondaryContainer }
                      ]}
                      textStyle={[styles.categoryChipText, { color: theme.colors.onSecondaryContainer }]}
                      compact
                    >
                      {category.length > 12 ? `${category.substring(0, 12)}...` : category}
                    </Chip>
                  ))}
                  {book.categories.length > 2 && (
                    <Text style={[styles.moreCategories, { color: theme.colors.onSurfaceVariant }]}>
                      +{book.categories.length - 2} more 
                    </Text>
                  )}
                </View>
              )}

              {/* Progress */}
              <View style={styles.progressContainer}>
                <ProgressBar 
                  progress={completion}
                  color={theme.colors.primary}
                  style={styles.progressBar}
                />
                <View style={styles.progressRow}>
                  <Text 
                    variant="bodySmall" 
                    style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {completionText} • Page {book.current_page}/{book.number_of_pages}
                  </Text>
                  {/* Note button - only show if book has notes */}
                  {book.has_notes === 1 && (
                    <IconButton
                      icon="note-text"
                      size={18}
                      iconColor={theme.colors.primary}
                      style={[styles.noteButton, { backgroundColor: theme.colors.primaryContainer }]}
                      onPress={() => handleViewNote(book)}
                    />
                  )}
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const StatCard = ({ title, value, subtitle, progress }: {
    title: string;
    value: string | number;
    subtitle?: string;
    progress?: number;
  }) => (
    <Card style={[styles.statCard, { backgroundColor: theme.colors.surface }]} mode="contained">
      <Card.Content style={styles.statContent}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, opacity: 0.7 }}>
          {title}
        </Text>
        <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
          {value}
        </Text>
        {subtitle && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurface, opacity: 0.6 }}>
            {subtitle}
          </Text>
        )}
        {progress !== undefined && (
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* Header */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <BookIcon 
                width={scale(40)} 
                height={scale(40)} 
                primaryColor={theme.colors.primary}
                secondaryColor={theme.colors.primaryContainer}
                accentColor={theme.colors.primary}
              />
              <Text variant="headlineLarge" style={[styles.appName, { color: theme.colors.primary }]}>
                ribbon
              </Text>
            </View>
            <Text variant="bodyLarge" style={[styles.tagline, { color: theme.colors.onSurface }]}>
              {t('home.appTagline')}
            </Text>
          </View>
        </Surface>

        {/* Continue Reading Section */}
        <View style={styles.section}>
          
          <Card 
            style={[styles.continueReadingCard, { backgroundColor: theme.colors.primaryContainer }]} 
            elevation={2}
          >
            <Card.Content style={styles.continueReadingContent}>
              {booksInProgress.length > 0 ? (
                <View style={styles.continueContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalScrollContent}
                    style={styles.horizontalScroll}
                  >
                    {booksInProgress.map((book, index) => (
                      <View 
                        key={book.book_id} 
                        style={[
                          styles.bookCardContainer,
                          index === booksInProgress.length - 1 && { marginRight: 0 }
                        ]}
                      >
                        {renderBookCard(book)}
                      </View>
                    ))}
                  </ScrollView>
                  
                  {/* See All Button */}
                  <Button
                    mode="contained"
                    onPress={() => navigation.navigate('LibraryStack')}
                    style={[styles.seeAllButton, { backgroundColor: theme.colors.primary }]}
                    contentStyle={styles.seeAllButtonContent}
                    labelStyle={[styles.seeAllText, { color: theme.colors.surface }]}
                  >
                    {t('home.seeAllBooks')}
                  </Button>
                </View>
              ) : (
                <View style={styles.emptyStateContainer}>
                  <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                    {t('home.noBooksInProgress')}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8, marginTop: verticalScale(4) }}>
                    {t('home.startReadingPrompt')}
                  </Text>
                  <Button
                    mode="contained"
                    style={[styles.addBookButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => navigation.navigate('LibraryStack')}
                    contentStyle={{ paddingVertical: verticalScale(4) }}
                    labelStyle={{ color: '#FFFFFF' }}
                  >
                    {t('home.browseLibrary')}
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <StatCard title={t('home.totalBooks')} value={stats.totalBooks} />
            <StatCard title={t('home.currentlyReading')} value={stats.currentlyReading} />
            <StatCard 
              title={t('home.pagesToday')} 
              value={stats.pagesReadToday} 
              subtitle={stats.pagesReadToday > 0 ? t('home.greatProgress') : t('home.noReadingToday')} 
            />
            <StatCard 
              title={t('home.thisWeek')} 
              value={stats.pagesReadThisWeek} 
              subtitle={t('home.pagesRead')}
            />
            
            {/* Reading Streak card */}
            <StatCard 
              title={t('home.readingStreak')} 
              value={`${stats.readingStreak} ${t('home.days')}`} 
              subtitle={stats.readingStreak > 0 ? t('home.keepItUp') : t('home.startStreak')}
            />
            
            {/* Finished Books card */}
            <StatCard 
              title={t('home.finishedBooks')} 
              value={stats.finishedBooks} 
            />
          </View>
          
          {/* Go to Stats Button */}
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Stats')}
            style={[styles.goToStatsButton, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.goToStatsButtonContent}
            labelStyle={[styles.goToStatsText, { color: theme.colors.surface }]}
            icon={({ size, color }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            )}
          >
            Go to Stats
          </Button>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

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
                
                <ScrollView style={styles.noteContent} showsVerticalScrollIndicator={true}>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(24),
    marginBottom: verticalScale(8),
  },
  headerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  appName: {
    marginLeft: scale(12),
    fontWeight: '300',
    letterSpacing: moderateScale(2),
  },
  tagline: {
    opacity: 0.7,
  },
  section: {
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(24),
  },
  sectionTitle: {
    marginBottom: verticalScale(16),
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  statCard: {
    width: (width - scale(52)) / 2,
    marginBottom: verticalScale(12),
    borderRadius: scale(16),
    elevation: 2,
    shadowOpacity: 0.05,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: verticalScale(18),
    paddingHorizontal: verticalScale(12),
  },
  progressBar: {
    marginTop: verticalScale(10),
    height: verticalScale(6),
    borderRadius: scale(3),
  },
  continueCard: {
    padding: scale(8),
  },
  addBookButton: {
    marginTop: verticalScale(16),
    alignSelf: 'center',
  },
  bottomSpacing: {
    height: verticalScale(60),
  },
  // New styles for books and stats
  continueContainer: {
    gap: verticalScale(12),
  },
  bookCardContainer: {
    marginRight: scale(12),
    width: scale(280),
  },
  bookCard: {
    borderRadius: scale(16),
    elevation: 3,
    shadowOpacity: 0.1,
  },
  bookContent: {
    flexDirection: 'row',
    padding: scale(16),
  },
  coverContainer: {
    marginRight: scale(16),
    elevation: 2,
    shadowOpacity: 0.1,
  },
  coverImage: {
    width: scale(55),
    height: scale(82),
    borderRadius: scale(8),
  },
  coverPlaceholder: {
    width: scale(55),
    height: scale(82),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(4),
  },
  bookAuthor: {
    marginBottom: verticalScale(8),
  },
  yearInTitle: {
    fontWeight: '400',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  star: {
    fontSize: scale(12),
    marginRight: scale(1),
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: verticalScale(8),
    gap: scale(4),
  },
  categoryChip: {
    height: scale(22),
    borderRadius: scale(11),
    paddingHorizontal: scale(8),
  },
  categoryChipText: {
    fontSize: scale(10),
    lineHeight: scale(12),
  },
  moreCategories: {
    fontSize: scale(10),
    fontStyle: 'italic',
    fontWeight: '500',
    marginTop: scale(1),
  },
  progressContainer: {
    marginTop: verticalScale(4),
  },
  progressText: {
    marginTop: verticalScale(4),
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  noteButton: {
    marginLeft: scale(4),
    width: scale(32),
    height: scale(32),
  },
  seeAllButton: {
    marginTop: verticalScale(20),
    borderRadius: scale(12),
    elevation: 1,
    shadowOpacity: 0.1,
  },
  seeAllButtonContent: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(24),
  },
  seeAllText: {
    fontWeight: '600',
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  statsButton: {
    margin: 0,
  },
  // Continue Reading Card Styles
  continueReadingCard: {
    borderRadius: scale(16),
    marginTop: verticalScale(8),
  },
  continueReadingContent: {
    padding: scale(4),
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: verticalScale(16),
  },
  // Go to Stats Button
  goToStatsButton: {
    marginTop: verticalScale(16),
    borderRadius: scale(25),
    elevation: 2,
    shadowOpacity: 0.1,
    alignSelf: 'center',
  },
  goToStatsButtonContent: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(20),
  },
  goToStatsText: {
    fontWeight: '600',
    fontSize: scale(14),
  },
  // Horizontal scroll styles
  horizontalScroll: {
    marginBottom: verticalScale(8),
  },
  horizontalScrollContent: {
    paddingHorizontal: scale(4),
    paddingRight: scale(20),
  },
  // Modal styles
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
    maxHeight: verticalScale(300),
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
});

export default Home;
