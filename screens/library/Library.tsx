import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  Dimensions 
} from 'react-native';
import { 
  Text, 
  FAB, 
  Card,
  ProgressBar,
  Menu,
  Button,
  Chip,
  Searchbar,
  ActivityIndicator,
  Divider
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import AddBookModal from '../../components/AddBookModal';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList } from '../../utils/types';
import { useSQLiteContext } from 'expo-sqlite';

type LibraryNavigationProp = StackNavigationProp<LibraryStackParamList, 'Library'>;

const { width: screenWidth } = Dimensions.get('window');
const COVER_WIDTH = screenWidth * 0.2;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

interface Book {
  book_id: number;
  book_type: string;
  title: string;
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  isbn?: string;
  year_published?: number;
  date_added: string;
  current_page: number;
  review?: string;
  notes?: string;
  stars?: number;
  price?: number;
  authors: string[];
  categories: string[];
  publishers: string[];
}

interface FilterOptions {
  filterType: 'none' | 'author' | 'category' | 'publisher' | 'status' | 'bookType';
  filterValue: string;
}

interface SortOptions {
  sortBy: 'title' | 'completion' | 'yearPublished' | 'dateAdded';
  sortOrder: 'asc' | 'desc';
}

export default function Library() {
  const { theme } = useTheme();
  const navigation = useNavigation<LibraryNavigationProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ 
    filterType: 'none', 
    filterValue: '' 
  });
  const [sortOptions, setSortOptions] = useState<SortOptions>({ 
    sortBy: 'title', 
    sortOrder: 'asc' 
  });
  
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availablePublishers, setAvailablePublishers] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [])
  );

  useEffect(() => {
    applyFiltersAndSort();
  }, [books, searchQuery, filterOptions, sortOptions]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      // Load books with their related data
      const booksResult = await db.getAllAsync<any>(`
        SELECT 
          b.*,
          GROUP_CONCAT(DISTINCT a.name) as authors,
          GROUP_CONCAT(DISTINCT c.name) as categories,
          GROUP_CONCAT(DISTINCT p.name) as publishers
        FROM books b
        LEFT JOIN book_authors ba ON b.book_id = ba.book_id
        LEFT JOIN authors a ON ba.author_id = a.author_id
        LEFT JOIN book_categories bc ON b.book_id = bc.book_id
        LEFT JOIN categories c ON bc.category_id = c.category_id
        LEFT JOIN book_publishers bp ON b.book_id = bp.book_id
        LEFT JOIN publishers p ON bp.publisher_id = p.publisher_id
        GROUP BY b.book_id
        ORDER BY b.title ASC
      `);

      const processedBooks: Book[] = booksResult.map((book: any) => ({
        ...book,
        authors: book.authors ? book.authors.split(',') : [],
        categories: book.categories ? book.categories.split(',') : [],
        publishers: book.publishers ? book.publishers.split(',') : []
      }));

      setBooks(processedBooks);
      
      // Load available filter options
      const authorsResult = await db.getAllAsync<{name: string}>('SELECT DISTINCT name FROM authors ORDER BY name');
      const categoriesResult = await db.getAllAsync<{name: string}>('SELECT DISTINCT name FROM categories ORDER BY name');
      const publishersResult = await db.getAllAsync<{name: string}>('SELECT DISTINCT name FROM publishers ORDER BY name');
      
      setAvailableAuthors(authorsResult.map((row: any) => row.name));
      setAvailableCategories(categoriesResult.map((row: any) => row.name));
      setAvailablePublishers(publishersResult.map((row: any) => row.name));
      
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...books];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(book => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.authors.some(author => author.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filters
    if (filterOptions.filterType !== 'none' && filterOptions.filterValue) {
      filtered = filtered.filter(book => {
        switch (filterOptions.filterType) {
          case 'author':
            return book.authors.includes(filterOptions.filterValue);
          case 'category':
            return book.categories.includes(filterOptions.filterValue);
          case 'publisher':
            return book.publishers.includes(filterOptions.filterValue);
          case 'status':
            const completion = book.current_page / book.number_of_pages;
            if (filterOptions.filterValue === 'finished') {
              return completion >= 1;
            } else if (filterOptions.filterValue === 'reading') {
              return completion > 0 && completion < 1;
            } else if (filterOptions.filterValue === 'notStarted') {
              return completion === 0;
            }
            return true;
          case 'bookType':
            return book.book_type === filterOptions.filterValue;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortOptions.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'completion':
          const aCompletion = a.current_page / a.number_of_pages;
          const bCompletion = b.current_page / b.number_of_pages;
          comparison = aCompletion - bCompletion;
          break;
        case 'yearPublished':
          comparison = (a.year_published || 0) - (b.year_published || 0);
          break;
        case 'dateAdded':
          comparison = new Date(a.date_added).getTime() - new Date(b.date_added).getTime();
          break;
      }
      
      return sortOptions.sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredBooks(filtered);
  };

  const calculateCompletion = (currentPage: number, totalPages: number): number => {
    if (currentPage === 0 || totalPages === 0) return 0;
    return Math.min(currentPage / totalPages, 1);
  };

  const getCompletionText = (currentPage: number, totalPages: number): string => {
    const completion = calculateCompletion(currentPage, totalPages);
    return `${Math.round(completion * 100)}%`;
  };

  const handleBookPress = (book: Book) => {
    navigation.navigate('LibraryBookDetails', { bookId: book.book_id });
  };

  const handleScanBarcode = () => {
    navigation.navigate('ScanBarcode' as never);
  };

  const handleSearchOpenLibrary = () => {
    navigation.navigate('SearchBook' as never);
  };

  const handleAddManually = () => {
    navigation.navigate('AddBook');
  };

  const clearFilter = () => {
    setFilterOptions({ filterType: 'none', filterValue: '' });
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    const completion = calculateCompletion(item.current_page, item.number_of_pages);
    const completionText = getCompletionText(item.current_page, item.number_of_pages);
    
    return (
      <TouchableOpacity onPress={() => handleBookPress(item)}>
        <Card style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Card.Content style={styles.bookContent}>
            {/* Book Cover */}
            <View style={styles.coverContainer}>
              {(item.cover_path || item.cover_url) ? (
                <Image 
                  source={{ uri: item.cover_path || item.cover_url }} 
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.coverPlaceholderText, { color: theme.colors.onSurfaceVariant }]}>
                    {t('library.noCover')}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Book Info */}
            <View style={styles.bookInfo}>
              <Text 
                variant="titleMedium" 
                style={[styles.bookTitle, { color: theme.colors.onSurface }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              
              <Text 
                variant="bodyMedium" 
                style={[styles.bookAuthor, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {item.authors.join(', ') || t('library.unknownAuthor')}
              </Text>
              
              {/* Progress Bar */}
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
              
              {/* Categories */}
              {item.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {item.categories.slice(0, 2).map((category, index) => (
                    <Chip
                      key={`${category}-${index}`}
                      style={[styles.categoryChip, { backgroundColor: theme.colors.secondaryContainer }]}
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
              
              {/* Additional Info */}
              <View style={styles.additionalInfo}>
                <Text 
                  variant="bodySmall" 
                  style={[styles.pageInfo, { color: theme.colors.onSurfaceVariant }]}
                >
                  {item.current_page}/{item.number_of_pages} {t('library.pages')}
                </Text>
                {item.year_published && (
                  <Text 
                    variant="bodySmall" 
                    style={[styles.yearInfo, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {item.year_published}
                  </Text>
                )}
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderFilterMenu = () => (
    <Menu
      visible={filterMenuVisible}
      onDismiss={() => setFilterMenuVisible(false)}
      anchor={
        <Button
          mode="outlined"
          onPress={() => setFilterMenuVisible(true)}
          icon="filter"
          style={styles.filterButton}
        >
          {t('library.filter')}
        </Button>
      }
    >
      <Menu.Item 
        onPress={() => {
          setFilterOptions({ filterType: 'none', filterValue: '' });
          setFilterMenuVisible(false);
        }}
        title={t('library.noFilter')}
      />
      <Divider />
      
      {/* Author Filter */}
      {availableAuthors.length > 0 && (
        <>
          <Menu.Item title={t('library.filterByAuthor')} disabled />
          {availableAuthors.map(author => (
            <Menu.Item
              key={author}
              onPress={() => {
                setFilterOptions({ filterType: 'author', filterValue: author });
                setFilterMenuVisible(false);
              }}
              title={`  ${author}`}
            />
          ))}
          <Divider />
        </>
      )}
      
      {/* Category Filter */}
      {availableCategories.length > 0 && (
        <>
          <Menu.Item title={t('library.filterByCategory')} disabled />
          {availableCategories.map(category => (
            <Menu.Item
              key={category}
              onPress={() => {
                setFilterOptions({ filterType: 'category', filterValue: category });
                setFilterMenuVisible(false);
              }}
              title={`  ${category}`}
            />
          ))}
          <Divider />
        </>
      )}
      
      {/* Status Filter */}
      <Menu.Item title={t('library.filterByStatus')} disabled />
      <Menu.Item
        onPress={() => {
          setFilterOptions({ filterType: 'status', filterValue: 'reading' });
          setFilterMenuVisible(false);
        }}
        title={`  ${t('library.currentlyReading')}`}
      />
      <Menu.Item
        onPress={() => {
          setFilterOptions({ filterType: 'status', filterValue: 'finished' });
          setFilterMenuVisible(false);
        }}
        title={`  ${t('library.finished')}`}
      />
      <Menu.Item
        onPress={() => {
          setFilterOptions({ filterType: 'status', filterValue: 'notStarted' });
          setFilterMenuVisible(false);
        }}
        title={`  ${t('library.notStarted')}`}
      />
    </Menu>
  );

  const renderSortMenu = () => (
    <Menu
      visible={sortMenuVisible}
      onDismiss={() => setSortMenuVisible(false)}
      anchor={
        <Button
          mode="outlined"
          onPress={() => setSortMenuVisible(true)}
          icon="sort"
          style={styles.sortButton}
        >
          {t('library.sort')}
        </Button>
      }
    >
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'title', sortOrder: 'asc' });
          setSortMenuVisible(false);
        }}
        title={t('library.titleAsc')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'title', sortOrder: 'desc' });
          setSortMenuVisible(false);
        }}
        title={t('library.titleDesc')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'completion', sortOrder: 'desc' });
          setSortMenuVisible(false);
        }}
        title={t('library.completionDesc')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'completion', sortOrder: 'asc' });
          setSortMenuVisible(false);
        }}
        title={t('library.completionAsc')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'dateAdded', sortOrder: 'desc' });
          setSortMenuVisible(false);
        }}
        title={t('library.newestFirst')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'dateAdded', sortOrder: 'asc' });
          setSortMenuVisible(false);
        }}
        title={t('library.oldestFirst')}
      />
    </Menu>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
          {t('library.loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <Searchbar
        placeholder={t('library.searchBooks')}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />
      
      {/* Filter and Sort Controls */}
      <View style={[styles.controlsContainer, { backgroundColor: theme.colors.surface }]}>
        {renderFilterMenu()}
        {renderSortMenu()}
        
        {/* Active Filter Chip */}
        {filterOptions.filterType !== 'none' && (
          <Chip
            onClose={clearFilter}
            style={[styles.filterChip, { backgroundColor: theme.colors.primaryContainer }]}
          >
            {filterOptions.filterValue}
          </Chip>
        )}
      </View>
      
      {/* Books List */}
      {filteredBooks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
            {books.length === 0 ? t('library.noBooksYet') : t('library.noBooksFound')}
          </Text>
          {books.length === 0 && (
            <Text style={[styles.emptySubText, { color: theme.colors.onSurfaceVariant }]}>
              {t('library.addFirstBook')}
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredBooks}
          renderItem={renderBookItem}
          keyExtractor={(item) => item.book_id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      <AddBookModal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        onScanBarcode={handleScanBarcode}
        onSearchOpenLibrary={handleSearchOpenLibrary}
        onAddManually={handleAddManually}
      />
      
      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => setModalVisible(true)}
        color="#FFFFFF"
        size="medium"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    margin: scale(16),
    marginBottom: scale(8),
    elevation: 0,
    shadowOpacity: 0,
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    gap: scale(8),
    alignItems: 'center',
    marginBottom: scale(8),
    borderRadius: scale(8),
    marginHorizontal: scale(16),
    elevation: 1,
  },
  filterButton: {
    flex: 1,
    minHeight: scale(40),
  },
  sortButton: {
    flex: 1,
    minHeight: scale(40),
  },
  filterChip: {
    marginLeft: scale(8),
  },
  listContainer: {
    padding: scale(16),
    paddingTop: scale(8),
  },
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
  coverPlaceholderText: {
    fontSize: scale(10),
    textAlign: 'center',
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontWeight: '600',
    marginBottom: scale(4),
  },
  bookAuthor: {
    marginBottom: scale(8),
  },
  progressContainer: {
    marginBottom: scale(8),
  },
  progressBar: {
    height: scale(6),
    borderRadius: scale(3),
    marginBottom: scale(4),
  },
  progressText: {
    fontSize: scale(12),
    textAlign: 'right',
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
  additionalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pageInfo: {
    fontSize: scale(11),
  },
  yearInfo: {
    fontSize: scale(11),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  emptyText: {
    fontSize: scale(18),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: scale(8),
  },
  emptySubText: {
    fontSize: scale(14),
    textAlign: 'center',
  },
  loadingText: {
    marginTop: scale(16),
    fontSize: scale(16),
  },
  fab: {
    position: 'absolute',
    margin: scale(16),
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOpacity: 0.3,
  },
});
