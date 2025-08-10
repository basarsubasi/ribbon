
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
} from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import BookIcon from '../components/BookIcon';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSQLiteContext } from 'expo-sqlite';
import { getCoverImageUri } from '../utils/imageUtils';
import { FontAwesome } from '@expo/vector-icons';


const { width } = Dimensions.get('window');

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
}

interface ReadingStats {
  totalBooks: number;
  currentlyReading: number;
  pagesReadToday: number;
  pagesReadThisWeek: number;
  readingStreak: number;
}


const Home = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  
  const [stats, setStats] = useState<ReadingStats>({
    totalBooks: 0,
    currentlyReading: 0,
    pagesReadToday: 0,
    pagesReadThisWeek: 0,
    readingStreak: 0,
  });
  const [booksInProgress, setBooksInProgress] = useState<BookInProgress[]>([]);
  const [loading, setLoading] = useState(true);

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
          COALESCE(MAX(pl.page_log_id), 0) as latest_log_id
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
        LIMIT 3
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
        if (streak > 365) break;
      }

      setStats({
        totalBooks,
        currentlyReading,
        pagesReadToday,
        pagesReadThisWeek,
        readingStreak: streak,
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

  const renderBookCard = (book: BookInProgress) => {
    const completion = book.current_page / book.number_of_pages;
    const completionText = `${Math.round(completion * 100)}%`;

    return (
      <TouchableOpacity
        key={book.book_id}
        onPress={() => {
          // Navigate to LogPages with book ID and today's date
          (navigation as any).navigate('PageLogs', {
            screen: 'LogPages',
            params: { bookId: book.book_id }
          });
        }}
        activeOpacity={0.7}
        style={styles.bookCardContainer}
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
                      +{book.categories.length - 2}
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
                <Text 
                  variant="bodySmall" 
                  style={[styles.progressText, { color: theme.colors.onSurfaceVariant }]}
                >
                  {completionText} • Page {book.current_page}/{book.number_of_pages}
                </Text>
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
          <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
            {t('home.continueReading')}
          </Text>
          
          {booksInProgress.length > 0 ? (
            <View style={styles.continueContainer}>
              {booksInProgress.map(book => renderBookCard(book))}
              
              {/* See All Button */}
              <Button
                mode="contained"
                onPress={() => (navigation as any).navigate('Library')}
                style={[styles.seeAllButton, { borderColor: theme.colors.outline }]}
                contentStyle={styles.seeAllButtonContent}
                labelStyle={[styles.seeAllText, { color: theme.colors.surface }]}
              >
                {t('home.seeAllBooks')}
              </Button>
            </View>
          ) : (
            <Card style={[styles.continueCard, { backgroundColor: theme.colors.primaryContainer }]} mode="contained">
              <Card.Content>
                <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                  {t('home.noBooksInProgress')}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8, marginTop: verticalScale(4) }}>
                  {t('home.startReadingPrompt')}
                </Text>
                <Button
                  mode="contained"
                  style={[styles.addBookButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => (navigation as any).navigate('Library')}
                  contentStyle={{ paddingVertical: verticalScale(4) }}
                  labelStyle={{ color: '#FFFFFF' }}
                >
                  {t('home.browseLibrary')}
                </Button>
              </Card.Content>
            </Card>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <View style={styles.statsHeader}>
            <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
              {t('home.readingStats')}
            </Text>
            <IconButton
              icon="chart-line"
              size={24}
              iconColor={theme.colors.primary}
              style={styles.statsButton}
              onPress={() => (navigation as any).navigate('Stats')}
            />
          </View>
          <View style={styles.statsGrid}>
            <StatCard title={t('home.totalBooks')} value={stats.totalBooks} />
            <StatCard title={t('home.currentlyReading')} value={stats.currentlyReading} />
            <StatCard 
              title={t('home.pagesToday')} 
              value={stats.pagesReadToday} 
              subtitle={stats.pagesReadToday > 0 ? t('home.greatProgress') : t('home.noReadingToday')} 
              progress={Math.min(stats.pagesReadToday / 50, 1)} // Assume 50 pages is 100%
            />
            <StatCard 
              title={t('home.thisWeek')} 
              value={stats.pagesReadThisWeek} 
              subtitle={t('home.pagesRead')}
            />
            <StatCard 
              title={t('home.readingStreak')} 
              value={`${stats.readingStreak} ${t('home.days')}`} 
              subtitle={stats.readingStreak > 0 ? t('home.keepItUp') : t('home.startStreak')}
            />
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: verticalScale(16),
  },
  progressBar: {
    marginTop: verticalScale(8),
    height: verticalScale(4),
    borderRadius: scale(2),
  },
  continueCard: {
    padding: scale(8),
  },
  addBookButton: {
    marginTop: verticalScale(16),
    alignSelf: 'flex-start',
  },
  bottomSpacing: {
    height: verticalScale(60),
  },
  // New styles for books and stats
  continueContainer: {
    gap: verticalScale(12),
  },
  bookCardContainer: {
    marginBottom: verticalScale(8),
  },
  bookCard: {
    borderRadius: scale(12),
  },
  bookContent: {
    flexDirection: 'row',
    padding: scale(12),
  },
  coverContainer: {
    marginRight: scale(12),
  },
  coverImage: {
    width: scale(50),
    height: scale(75),
    borderRadius: scale(6),
  },
  coverPlaceholder: {
    width: scale(50),
    height: scale(75),
    borderRadius: scale(6),
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
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: verticalScale(4),
  },
  progressText: {
    marginTop: verticalScale(4),
    fontWeight: '500',
  },
  seeAllButton: {
    marginTop: verticalScale(16),
    borderRadius: scale(8),
  },
  seeAllButtonContent: {
    paddingVertical: verticalScale(8),
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
});

export default Home;
