import React, { useState } from 'react';
import { View, StyleSheet, FlatList, Alert, Image } from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  Button,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { 
  searchAndGetBookDetails, 
  ProcessedBookData 
} from '../../utils/openLibraryUtils';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList } from '../../utils/types';

type SearchBookNavigationProp = StackNavigationProp<LibraryStackParamList, 'SearchBook'>;

export default function SearchBook() {
  const { theme } = useTheme();
  const navigation = useNavigation<SearchBookNavigationProp>();
  const { t } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProcessedBookData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    try {
      const results = await searchAndGetBookDetails(searchQuery.trim(), 20);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching books:', error);
      Alert.alert(
        t('search.searchError'),
        t('search.searchErrorMessage')
      );
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookSelect = (book: ProcessedBookData) => {
    navigation.navigate('BookDetails', { bookData: book });
  };

  const renderBookItem = ({ item }: { item: ProcessedBookData }) => (
    <Card 
      style={[styles.bookCard, { backgroundColor: theme.colors.surface }]} 
      mode="contained"
      onPress={() => handleBookSelect(item)}
    >
      <Card.Content>
        <View style={styles.bookContent}>
          <View style={styles.coverContainer}>
            {item.coverUrl ? (
              <Image
                source={{ uri: item.coverUrl }}
                style={styles.coverImage}
                resizeMode="cover"
                onError={() => console.log('Failed to load cover image:', item.coverUrl)}
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <FontAwesome name="book" size={24} color={theme.colors.onSurface} />

              </View>
            )}
          </View>
          
          <View style={styles.bookInfo}>
            <Text 
              variant="titleMedium" 
              style={[styles.bookTitle, { color: theme.colors.onSurface }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            
            {item.authors.length > 0 && (
              <Text 
                variant="bodyMedium" 
                style={[styles.bookAuthor, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {t('search.byAuthor')} {item.authors.join(', ')}
              </Text>
            )}
            
            {item.publishYear && (
              <Text 
                variant="bodySmall" 
                style={[styles.bookYear, { color: theme.colors.onSurface }]}
              >
                {t('search.publishedLabel')} {item.publishYear}
              </Text>
            )}
            
            {item.numberOfPages && (
              <Text 
                variant="bodySmall" 
                style={[styles.bookPages, { color: theme.colors.onSurface }]}
              >
                {item.numberOfPages} {t('search.pagesLabel')}
              </Text>
            )}
            
            {item.subjects.length > 0 && (
              <View style={styles.subjectsContainer}>
                {item.subjects.slice(0, 3).map((subject, index) => (
                  <Chip
                    key={index}
                    style={[styles.subjectChip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={[styles.subjectText, { color: theme.colors.onPrimaryContainer }]}
                    compact
                  >
                    {subject}
                  </Chip>
                ))}
              </View>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.emptyText, { color: theme.colors.onBackground }]}>
            {t('search.searching')}
          </Text>
        </View>
      );
    }

    if (hasSearched && searchResults.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.onBackground }]}>
            {t('search.noResults')} "{searchQuery}"
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.onBackground }]}>
            {t('search.tryDifferent')}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.onBackground }]}>
          {t('search.searchPrompt')}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text 
          variant="titleLarge" 
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          {t('search.title')}
        </Text>
        
        <Searchbar
          placeholder={t('search.placeholder')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={handleSearch}
          onIconPress={handleSearch}
          style={[styles.searchBar, { backgroundColor: theme.colors.surface }]}
          inputStyle={{ color: theme.colors.onSurface }}
          iconColor={theme.colors.onSurface}
          placeholderTextColor={theme.colors.onSurface}
        />
        
        <Button
          mode="contained"
          onPress={handleSearch}
          disabled={!searchQuery.trim() || loading}
          style={[styles.searchButton, { backgroundColor: theme.colors.primary }]} labelStyle={{ color: '#FFFFFF' }}
        >
          {t('search.searchButton')}
        </Button>
      </View>

      <FlatList
        data={searchResults}
        renderItem={renderBookItem}
        keyExtractor={(item) => item.openLibraryKey}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={[styles.cancelButton, { borderColor: theme.colors.outline }]}
          textColor={theme.colors.onBackground}
        >
          {t('search.cancel')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: scale(20),
    paddingBottom: verticalScale(16),
  },
  title: {
    fontWeight: '600',
    marginBottom: verticalScale(16),
    textAlign: 'center',
  },
  searchBar: {
    marginBottom: verticalScale(12),
    elevation: 2,
  },
  searchButton: {
    marginTop: verticalScale(8),
  },
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: scale(20),
  },
  bookCard: {
    marginBottom: verticalScale(12),
    elevation: 2,
  },
  bookContent: {
    flexDirection: 'row',
  },
  coverContainer: {
    marginRight: scale(16),
  },
  coverPlaceholder: {
    width: scale(50),
    height: scale(75),
    borderRadius: scale(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: scale(50),
    height: scale(75),
    borderRadius: scale(6),
  },
  coverText: {
    fontSize: scale(24),
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    fontWeight: '600',
    marginBottom: verticalScale(4),
  },
  bookAuthor: {
    opacity: 0.8,
    marginBottom: verticalScale(4),
  },
  bookYear: {
    opacity: 0.6,
    marginBottom: verticalScale(2),
  },
  bookPages: {
    opacity: 0.6,
    marginBottom: verticalScale(8),
  },
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(4),
  },
  subjectChip: {
    marginVertical: verticalScale(2),
  },
  subjectText: {
    fontSize: scale(10),
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
  },
  emptyText: {
    textAlign: 'center',
    fontSize: scale(16),
    marginBottom: verticalScale(8),
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: scale(14),
    opacity: 0.7,
  },
  footer: {
    padding: scale(20),
    paddingTop: verticalScale(12),
  },
  cancelButton: {
    marginVertical: verticalScale(4),
  },
});
