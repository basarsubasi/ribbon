import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Image, 
  Alert,
  Dimensions 
} from 'react-native';
import {
  Text,
  Surface,
  Button,
  Chip,
  Divider,
  ActivityIndicator,
  Menu
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList, Book } from '../../utils/types';
import { ProcessedBookData } from '../../utils/openLibraryUtils';
import { useSQLiteContext } from 'expo-sqlite';

type OpenLibraryBookDetailsRouteProp = RouteProp<LibraryStackParamList, 'OpenLibraryBookDetails'>;
type OpenLibraryBookDetailsNavigationProp = StackNavigationProp<LibraryStackParamList, 'OpenLibraryBookDetails'>;

const { width: screenWidth } = Dimensions.get('window');
const COVER_WIDTH = screenWidth * 0.4;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

export default function OpenLibraryBookDetails() {
  const { theme } = useTheme();
  const navigation = useNavigation<OpenLibraryBookDetailsNavigationProp>();
  const route = useRoute<OpenLibraryBookDetailsRouteProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  
  const [book, setBook] = useState<Book | ProcessedBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLibraryBook, setIsLibraryBook] = useState(false);
  
  // Dropdown states for OpenLibrary books
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [publisherMenuVisible, setPublisherMenuVisible] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);

  const { bookId, bookData } = route.params;

  useEffect(() => {
    loadBookData();
  }, [bookId, bookData]);

  const loadBookData = async () => {
    setLoading(true);
    try {
      if (bookData) {
        // This is a book from OpenLibrary search
        setBook(bookData);
        setIsLibraryBook(false);
        
        // Set initial dropdown values (first alphabetically)
        const publishedBookData = bookData as ProcessedBookData;
        if (publishedBookData.publishers && publishedBookData.publishers.length > 0) {
          const sortedPublishers = [...publishedBookData.publishers].sort();
          setSelectedPublishers([sortedPublishers[0]]);
        }
        if (publishedBookData.subjects && publishedBookData.subjects.length > 0) {
          const sortedSubjects = [...publishedBookData.subjects].sort();
          setSelectedCategories([sortedSubjects[0]]);
        }
      } else if (bookId) {
        // This is a book from the user's library - fetch it from database
        await loadLibraryBook(bookId);
        setIsLibraryBook(true);
      }
    } catch (error) {
      console.error('Error loading book data:', error);
      Alert.alert(t('common.error'), 'Failed to load book details');
    } finally {
      setLoading(false);
    }
  };

  const loadLibraryBook = async (id: number) => {
    try {
      const bookResult = await db.getFirstAsync<any>(`
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
        WHERE b.book_id = ?
        GROUP BY b.book_id
      `, [id]);

      if (bookResult) {
        const processedBook: Book & { authors: string[]; categories: string[]; publishers: string[] } = {
          ...bookResult,
          authors: bookResult.authors ? bookResult.authors.split(',') : [],
          categories: bookResult.categories ? bookResult.categories.split(',') : [],
          publishers: bookResult.publishers ? bookResult.publishers.split(',') : []
        };
        setBook(processedBook);
      } else {
        Alert.alert(t('bookDetails.bookNotFound'), 'This book could not be found in your library');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading library book:', error);
      throw error;
    }
  };

  const handleAddToLibrary = () => {
    if (book && !isLibraryBook) {
      const bookDataWithSelection = {
        ...(book as ProcessedBookData),
        selectedPublishers,
        selectedCategories,
      };
      navigation.navigate('AddBook', { bookData: bookDataWithSelection });
    }
  };

  const addPublisher = (publisher: string) => {
    if (!selectedPublishers.includes(publisher)) {
      setSelectedPublishers([...selectedPublishers, publisher]);
    }
    setPublisherMenuVisible(false);
  };

  const removePublisher = (publisher: string) => {
    setSelectedPublishers(selectedPublishers.filter(p => p !== publisher));
  };

  const addCategory = (category: string) => {
    if (!selectedCategories.includes(category)) {
      setSelectedCategories([...selectedCategories, category]);
    }
    setCategoryMenuVisible(false);
  };

  const removeCategory = (category: string) => {
    setSelectedCategories(selectedCategories.filter(c => c !== category));
  };

  const getAvailablePublishers = () => {
    const allPublishers = (book as ProcessedBookData).publishers || [];
    return allPublishers.filter(p => !selectedPublishers.includes(p)).sort();
  };

  const getAvailableCategories = () => {
    const allCategories = (book as ProcessedBookData).subjects || [];
    return allCategories.filter(c => !selectedCategories.includes(c)).sort();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContainer}>
          <Text variant="headlineSmall" style={{ color: theme.colors.onBackground }}>
            {t('bookDetails.bookNotFound')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover and Basic Info */}
        <Surface style={[styles.headerSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.coverContainer}>
            {(book as ProcessedBookData).coverUrl || (book as Book).cover_url ? (
              <Image
                source={{ 
                  uri: (book as ProcessedBookData).coverUrl || (book as Book).cover_url 
                }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.coverPlaceholderText, { color: theme.colors.onPrimary }]}>
                  📖
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.basicInfo}>
            <Text 
              variant="headlineSmall" 
              style={[styles.title, { color: theme.colors.onSurface }]}
            >
              {(book as ProcessedBookData).title || (book as Book).title}
            </Text>
            
            {((book as ProcessedBookData).authors?.length > 0 || isLibraryBook) && (
              <Text 
                variant="bodyLarge" 
                style={[styles.authors, { color: theme.colors.onSurface }]}
              >
                {isLibraryBook 
                  ? 'Authors from database' // TODO: Get authors from database
                  : (book as ProcessedBookData).authors.join(', ')
                }
              </Text>
            )}
            
            {((book as ProcessedBookData).publishYear || (book as Book).year_published) && (
              <Text 
                variant="bodyMedium" 
                style={[styles.publishInfo, { color: theme.colors.onSurface }]}
              >
                {t('bookDetails.published')} {(book as ProcessedBookData).publishYear || (book as Book).year_published}
              </Text>
            )}
            
            {((book as ProcessedBookData).numberOfPages || (book as Book).number_of_pages) && (
              <Text 
                variant="bodyMedium" 
                style={[styles.publishInfo, { color: theme.colors.onSurface }]}
              >
                {(book as ProcessedBookData).numberOfPages || (book as Book).number_of_pages} {t('bookDetails.pages')}
              </Text>
            )}
          </View>
        </Surface>

        {/* ISBN Information */}
        {((book as ProcessedBookData).isbn_13 || (book as Book).isbn_13) && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.isbn')}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              {(book as ProcessedBookData).isbn_13 || (book as Book).isbn_13}
            </Text>
          </Surface>
        )}

        {/* Publisher */}
        {(book as ProcessedBookData).publishers?.length > 0 && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.publisher')}
            </Text>
            
            {/* Selected Publisher Chips */}
            <View style={styles.chipsContainer}>
              {selectedPublishers.map((publisher, index) => (
                <Chip
                  key={index}
                  style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
                  textStyle={{ color: theme.colors.onPrimaryContainer }}
                  compact
                  onClose={() => removePublisher(publisher)}
                  closeIcon="close"
                >
                  {publisher}
                </Chip>
              ))}
            </View>

            {/* Add Publisher Menu */}
            {getAvailablePublishers().length > 0 && (
              <Menu
                visible={publisherMenuVisible}
                onDismiss={() => setPublisherMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setPublisherMenuVisible(true)}
                    style={[styles.addTagButton, { borderColor: theme.colors.outline }]}
                    contentStyle={styles.addTagButtonContent}
                    icon="plus"
                  >
                    <Text style={{ color: theme.colors.onSurface }}>
                      Add Publisher
                    </Text>
                  </Button>
                }
              >
                {getAvailablePublishers().map((publisher, index) => (
                  <Menu.Item
                    key={index}
                    onPress={() => addPublisher(publisher)}
                    title={publisher}
                  />
                ))}
              </Menu>
            )}
          </Surface>
        )}

        {/* Category */}
        {(book as ProcessedBookData).subjects?.length > 0 && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.category')}
            </Text>
            
            {/* Selected Category Chips */}
            <View style={styles.chipsContainer}>
              {selectedCategories.map((category, index) => (
                <Chip
                  key={index}
                  style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}
                  textStyle={{ color: theme.colors.onSecondaryContainer }}
                  compact
                  onClose={() => removeCategory(category)}
                  closeIcon="close"
                >
                  {category}
                </Chip>
              ))}
            </View>

            {/* Add Category Menu */}
            {getAvailableCategories().length > 0 && (
              <Menu
                visible={categoryMenuVisible}
                onDismiss={() => setCategoryMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCategoryMenuVisible(true)}
                    style={[styles.addTagButton, { borderColor: theme.colors.outline }]}
                    contentStyle={styles.addTagButtonContent}
                    icon="plus"
                  >
                    <Text style={{ color: theme.colors.onSurface }}>
                      Add Category
                    </Text>
                  </Button>
                }
              >
                {getAvailableCategories().slice(0, 10).map((category, index) => (
                  <Menu.Item
                    key={index}
                    onPress={() => addCategory(category)}
                    title={category}
                  />
                ))}
              </Menu>
            )}
          </Surface>
        )}

        {/* Description */}
        {(book as ProcessedBookData).description && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.description')}
            </Text>
            <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurface }]}>
              {(book as ProcessedBookData).description}
            </Text>
          </Surface>
        )}

        {/* Library Info for existing books */}
        {isLibraryBook && (book as Book).current_page !== undefined && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.readingProgress')}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              {t('bookDetails.currentPage')} {(book as Book).current_page} / {(book as Book).number_of_pages}
            </Text>
            {(book as Book).last_read && (
              <Text variant="bodySmall" style={[styles.lastRead, { color: theme.colors.onSurface }]}>
                {t('bookDetails.lastRead')} {new Date((book as Book).last_read!).toLocaleDateString()}
              </Text>
            )}
          </Surface>
        )}
      </ScrollView>

      {/* Add to Library Button - only for OpenLibrary books */}
      {!isLibraryBook && (
        <View style={[styles.bottomButton, { backgroundColor: theme.colors.background }]}>
          <Button
            mode="contained"
            onPress={handleAddToLibrary}
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.addButtonContent}
          >
            <Text style={[styles.addButtonText, { color: '#FFFFFF' }]}>
              {t('bookDetails.addToLibrary')}
            </Text>
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: {
    padding: scale(20),
    flexDirection: 'row',
    marginBottom: verticalScale(16),
  },
  coverContainer: {
    marginRight: scale(20),
  },
  coverImage: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(8),
  },
  coverPlaceholder: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: scale(48),
  },
  basicInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: verticalScale(8),
    lineHeight: scale(28),
  },
  authors: {
    marginBottom: verticalScale(6),
    opacity: 0.8,
  },
  publishInfo: {
    marginBottom: verticalScale(4),
    opacity: 0.7,
  },
  section: {
    padding: scale(20),
    marginHorizontal: scale(16),
    marginBottom: verticalScale(16),
    borderRadius: scale(12),
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(12),
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    marginVertical: verticalScale(2),
  },
  description: {
    lineHeight: scale(22),
  },
  lastRead: {
    marginTop: verticalScale(4),
    opacity: 0.7,
  },
  dropdownButton: {
    justifyContent: 'flex-start',
    marginBottom: verticalScale(8),
  },
  dropdownContent: {
    justifyContent: 'flex-start',
  },
  addTagButton: {
    marginTop: verticalScale(8),
    alignSelf: 'flex-start',
  },
  addTagButtonContent: {
    paddingVertical: verticalScale(4),
  },
  bottomButton: {
    padding: scale(20),
    paddingTop: verticalScale(12),
  },
  addButton: {
    borderRadius: scale(25),
  },
  addButtonContent: {
    paddingVertical: verticalScale(8),
  },
  addButtonText: {
    fontSize: scale(16),
    fontWeight: '600',
  },
});
