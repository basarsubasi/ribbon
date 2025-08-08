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
import { getCoverImageUri } from '../../utils/imageUtils';
import { FontAwesome} from '@expo/vector-icons';


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
  status?: string[];
  bookType?: string[];
  authors?: string[];
  categories?: string[];
  publishers?: string[];
}

interface SortOptions {
  sortBy: 'title' | 'completion' | 'yearPublished' | 'dateAdded' | 'stars' | 'price';
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
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [sortOptions, setSortOptions] = useState<SortOptions>({ 
    sortBy: 'title', 
    sortOrder: 'asc' 
  });
  
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availablePublishers, setAvailablePublishers] = useState<string[]>([]);
  const [availableBookTypes, setAvailableBookTypes] = useState<string[]>([]);

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
      const bookTypesResult = await db.getAllAsync<{book_type: string}>('SELECT DISTINCT book_type FROM books ORDER BY book_type');
      
      setAvailableAuthors(authorsResult.map((row: any) => row.name));
      setAvailableCategories(categoriesResult.map((row: any) => row.name));
      setAvailablePublishers(publishersResult.map((row: any) => row.name));
      setAvailableBookTypes(bookTypesResult.map((row: any) => row.book_type));
      
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

    // Apply multiple filters
    filtered = filtered.filter(book => {
      // Status filter
      if (filterOptions.status && filterOptions.status.length > 0) {
        const completion = book.current_page / book.number_of_pages;
        const matchesStatus = filterOptions.status.some(status => {
          if (status === 'finished') return completion >= 1;
          if (status === 'reading') return completion > 0 && completion < 1;
          if (status === 'notStarted') return completion === 0;
          return false;
        });
        if (!matchesStatus) return false;
      }

      // Book type filter
      if (filterOptions.bookType && filterOptions.bookType.length > 0) {
        if (!filterOptions.bookType.includes(book.book_type)) return false;
      }

      // Authors filter
      if (filterOptions.authors && filterOptions.authors.length > 0) {
        const matchesAuthor = filterOptions.authors.some(author => 
          book.authors.includes(author)
        );
        if (!matchesAuthor) return false;
      }

      // Categories filter
      if (filterOptions.categories && filterOptions.categories.length > 0) {
        const matchesCategory = filterOptions.categories.some(category => 
          book.categories.includes(category)
        );
        if (!matchesCategory) return false;
      }

      // Publishers filter
      if (filterOptions.publishers && filterOptions.publishers.length > 0) {
        const matchesPublisher = filterOptions.publishers.some(publisher => 
          book.publishers.includes(publisher)
        );
        if (!matchesPublisher) return false;
      }

      return true;
    });

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
        case 'stars':
          comparison = (a.stars || 0) - (b.stars || 0);
          break;
        case 'price':
          // Treat null/undefined prices as 0
          const aPrice = a.price == null ? 0 : a.price;
          const bPrice = b.price == null ? 0 : b.price;
          comparison = aPrice - bPrice;
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
    setFilterOptions({
      status: [],
      bookType: [],
      authors: [],
      categories: [],
      publishers: []
    });
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
              {getCoverImageUri(item.cover_path, item.cover_url) ? (
                <Image 
                  source={{ uri: getCoverImageUri(item.cover_path, item.cover_url)! }} 
                  style={styles.coverImage}
                  resizeMode="cover"
                  onError={(error) => console.log('Failed to load book cover:', error.nativeEvent.error)}
                />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.coverPlaceholderText, { color: theme.colors.onSurfaceVariant }]}>
                <FontAwesome name="book" size={24} color={theme.colors.onSurface} />
                  </Text>
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
                {item.authors.join(', ') || t('library.unknownAuthor')}
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
              </View>
              
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
          mode="contained"
          onPress={() => setFilterMenuVisible(true)}
          icon="filter"
          style={styles.filterButton}
          buttonColor={theme.colors.primary}
          textColor="white"
        >
          {t('library.filter')}
        </Button>
      }
    >
      <Menu.Item 
        onPress={() => {
          clearFilter();
          setFilterMenuVisible(false);
        }}
        title={t('library.noFilter')}
      />
      <Divider />
      
      {/* Reading Status Filter - moved to top */}
      <Menu.Item title={t('library.filterByStatus')} disabled />
      <Menu.Item
        onPress={() => {
          setFilterOptions(prev => ({
            ...prev,
            status: (prev.status || []).includes('reading') 
              ? (prev.status || []).filter(s => s !== 'reading')
              : [...(prev.status || []), 'reading']
          }));
          setFilterMenuVisible(false);
        }}
        title={`  ${t('library.currentlyReading')}`}
      />
      <Menu.Item
        onPress={() => {
          setFilterOptions(prev => ({
            ...prev,
            status: (prev.status || []).includes('finished') 
              ? (prev.status || []).filter(s => s !== 'finished')
              : [...(prev.status || []), 'finished']
          }));
          setFilterMenuVisible(false);
        }}
        title={`  ${t('library.finished')}`}
      />
      <Menu.Item
        onPress={() => {
          setFilterOptions(prev => ({
            ...prev,
            status: (prev.status || []).includes('notStarted') 
              ? (prev.status || []).filter(s => s !== 'notStarted')
              : [...(prev.status || []), 'notStarted']
          }));
          setFilterMenuVisible(false);
        }}
        title={`  ${t('library.notStarted')}`}
      />
      <Divider />
      
      {/* Book Type Filter */}
      {availableBookTypes.length > 0 && (
        <>
          <Menu.Item title={t('library.filterByBookType')} disabled />
          {availableBookTypes.map(bookType => (
            <Menu.Item
              key={bookType}
              onPress={() => {
                setFilterOptions(prev => ({
                  ...prev,
                  bookType: (prev.bookType || []).includes(bookType)
                    ? (prev.bookType || []).filter(bt => bt !== bookType)
                    : [...(prev.bookType || []), bookType]
                }));
                setFilterMenuVisible(false);
              }}
              title={`  ${bookType.charAt(0).toUpperCase() + bookType.slice(1)}`}
            />
          ))}
          <Divider />
        </>
      )}
      
      {/* Author Filter */}
      {availableAuthors.length > 0 && (
        <>
          <Menu.Item title={t('library.filterByAuthor')} disabled />
          {availableAuthors.map(author => (
            <Menu.Item
              key={author}
              onPress={() => {
                setFilterOptions(prev => ({
                  ...prev,
                  authors: (prev.authors || []).includes(author)
                    ? (prev.authors || []).filter(a => a !== author)
                    : [...(prev.authors || []), author]
                }));
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
                setFilterOptions(prev => ({
                  ...prev,
                  categories: (prev.categories || []).includes(category)
                    ? (prev.categories || []).filter(c => c !== category)
                    : [...(prev.categories || []), category]
                }));
                setFilterMenuVisible(false);
              }}
              title={`  ${category}`}
            />
          ))}
        </>
      )}
    </Menu>
  );

  const renderSortMenu = () => (
    <Menu
      visible={sortMenuVisible}
      onDismiss={() => setSortMenuVisible(false)}
      anchor={
        <Button
          mode="contained"
          onPress={() => setSortMenuVisible(true)}
          icon="sort"
          style={styles.sortButton}
          buttonColor={theme.colors.primary}
          textColor="white"
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
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'stars', sortOrder: 'desc' });
          setSortMenuVisible(false);
        }}
        title={t('library.starsDesc')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'stars', sortOrder: 'asc' });
          setSortMenuVisible(false);
        }}
        title={t('library.starsAsc')}
      />
      <Divider />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'price', sortOrder: 'asc' });
          setSortMenuVisible(false);
        }}
        title={t('library.priceAsc')}
      />
      <Menu.Item
        onPress={() => {
          setSortOptions({ sortBy: 'price', sortOrder: 'desc' });
          setSortMenuVisible(false);
        }}
        title={t('library.priceDesc')}
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
      <View style={styles.controlsContainer}>
        <View style={styles.buttonsRow}>
          {renderFilterMenu()}
          {renderSortMenu()}
        </View>
      </View>
      
      {/* Active Filter Chips - Separate Row */}
      {((filterOptions.status?.length || 0) + 
        (filterOptions.bookType?.length || 0) + 
        (filterOptions.authors?.length || 0) + 
        (filterOptions.categories?.length || 0)) > 0 && (
        <View style={styles.activeFiltersContainer}>
        {/* Status filters */}
        {(filterOptions.status || []).map(status => (
          <Chip
            key={`status-${status}`}
            onClose={() => {
              setFilterOptions(prev => ({
                ...prev,
                status: (prev.status || []).filter(s => s !== status)
              }));
            }}
            style={[styles.filterChip, { backgroundColor: theme.colors.primaryContainer }]}
            textStyle={styles.filterChipText}
          >
            {t(`library.${status}`)}
          </Chip>
        ))}
        
        {/* Book type filters */}
        {(filterOptions.bookType || []).map(bookType => (
          <Chip
            key={`bookType-${bookType}`}
            onClose={() => {
              setFilterOptions(prev => ({
                ...prev,
                bookType: (prev.bookType || []).filter(bt => bt !== bookType)
              }));
            }}
            style={[styles.filterChip, { backgroundColor: theme.colors.secondaryContainer }]}
            textStyle={styles.filterChipText}
          >
            {bookType.charAt(0).toUpperCase() + bookType.slice(1)}
          </Chip>
        ))}
        
        {/* Author filters */}
        {(filterOptions.authors || []).map(author => (
          <Chip
            key={`author-${author}`}
            onClose={() => {
              setFilterOptions(prev => ({
                ...prev,
                authors: (prev.authors || []).filter(a => a !== author)
              }));
            }}
            style={[styles.filterChip, { backgroundColor: theme.colors.tertiaryContainer }]}
            textStyle={styles.filterChipText}
          >
            {author}
          </Chip>
        ))}
        
        {/* Category filters with different colors */}
        {(filterOptions.categories || []).map((category, index) => {
          const categoryColors = [
            theme.colors.primaryContainer,
            theme.colors.secondaryContainer, 
            theme.colors.tertiaryContainer,
            theme.colors.errorContainer,
            theme.colors.surfaceVariant,
          ];
          return (
            <Chip
              key={`category-${category}`}
              onClose={() => {
                setFilterOptions(prev => ({
                  ...prev,
                  categories: (prev.categories || []).filter(c => c !== category)
                }));
              }}
              style={[styles.filterChip, { backgroundColor: categoryColors[index % categoryColors.length] }]}
              textStyle={styles.filterChipText}
            >
              {category}
            </Chip>
          );
        })}
      </View>
      )}
      
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
    marginBottom: scale(16),
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
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: scale(8),
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sortButton: {
    minHeight: scale(40),
    borderWidth: 0,
  },
  filterButton: {
    minHeight: scale(40),
    borderWidth: 0,
  },

  filterChip: {
    marginLeft: scale(8),
    flexShrink: 0,
  },
  filterChipText: {
    fontSize: scale(12),
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: scale(16),
    paddingBottom: scale(8),
    paddingTop: scale(8),
    gap: scale(8),
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
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(15),
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
