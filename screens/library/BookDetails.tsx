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
  ActivityIndicator
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList, Book } from '../../utils/types';
import { ProcessedBookData } from '../../utils/openLibraryUtils';

type BookDetailsRouteProp = RouteProp<LibraryStackParamList, 'BookDetails'>;
type BookDetailsNavigationProp = StackNavigationProp<LibraryStackParamList, 'BookDetails'>;

const { width: screenWidth } = Dimensions.get('window');
const COVER_WIDTH = screenWidth * 0.4;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

export default function BookDetails() {
  const { theme } = useTheme();
  const navigation = useNavigation<BookDetailsNavigationProp>();
  const route = useRoute<BookDetailsRouteProp>();
  const { t } = useTranslation();
  
  const [book, setBook] = useState<Book | ProcessedBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLibraryBook, setIsLibraryBook] = useState(false);

  const { bookId, bookData } = route.params;

  useEffect(() => {
    if (bookData) {
      // This is a book from OpenLibrary search
      setBook(bookData);
      setIsLibraryBook(false);
      setLoading(false);
    } else if (bookId) {
      // This is a book from the user's library - we'd need to fetch it from database
      // For now, we'll show a placeholder
      setIsLibraryBook(true);
      setLoading(false);
      // TODO: Fetch book from SQLite database using bookId
    }
  }, [bookId, bookData]);

  const handleAddToLibrary = () => {
    if (book && !isLibraryBook) {
      navigation.navigate('AddBook', { bookData: book as ProcessedBookData });
    }
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

        {/* Publishers */}
        {(book as ProcessedBookData).publishers?.length > 0 && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.publishers')}
            </Text>
            <View style={styles.chipsContainer}>
              {(book as ProcessedBookData).publishers.map((publisher, index) => (
                <Chip
                  key={index}
                  style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
                  textStyle={{ color: theme.colors.onPrimaryContainer }}
                  compact
                >
                  {publisher}
                </Chip>
              ))}
            </View>
          </Surface>
        )}

        {/* Subjects/Categories */}
        {(book as ProcessedBookData).subjects?.length > 0 && (
          <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              {t('bookDetails.subjects')}
            </Text>
            <View style={styles.chipsContainer}>
              {(book as ProcessedBookData).subjects.slice(0, 10).map((subject, index) => (
                <Chip
                  key={index}
                  style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}
                  textStyle={{ color: theme.colors.onSecondaryContainer }}
                  compact
                >
                  {subject}
                </Chip>
              ))}
            </View>
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
            <Text style={[styles.addButtonText, { color: theme.colors.onPrimary }]}>
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
