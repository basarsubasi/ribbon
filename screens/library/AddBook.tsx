import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert,
  TouchableOpacity,
  Image,
  Dimensions
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  Menu,
  Chip,
  ActivityIndicator,
  Divider,
  Card,
  IconButton
} from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale } from 'react-native-size-matters';
import { StackNavigationProp } from '@react-navigation/stack';
import { LibraryStackParamList } from '../../utils/types';
import { ProcessedBookData } from '../../utils/openLibraryUtils';
import * as SQLite from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { 
  saveLocalBookCover, 
  cacheRemoteBookCover, 
  deleteOldCover, 
  getCoverImageUri,
  initializeImageDirectories 
} from '../../utils/imageUtils';

type AddBookRouteProp = RouteProp<LibraryStackParamList, 'AddBook'>;
type AddBookNavigationProp = StackNavigationProp<LibraryStackParamList, 'AddBook'>;

const { width: screenWidth } = Dimensions.get('window');
const COVER_WIDTH = screenWidth * 0.3;
const COVER_HEIGHT = COVER_WIDTH * 1.5;

// Book type options with translation keys
const BOOK_TYPES = [
  { key: 'paperback', value: 'Paperback' },
  { key: 'hardcover', value: 'Hardcover' },
  { key: 'ebook', value: 'E-book' },
  { key: 'pdf', value: 'PDF' },
  { key: 'other', value: 'Other' }
];

interface ExistingData {
  authors: string[];
  categories: string[];
  publishers: string[];
}

export default function AddBook() {
  const { theme } = useTheme();
  const navigation = useNavigation<AddBookNavigationProp>();
  const route = useRoute<AddBookRouteProp>();
  const { t } = useTranslation();
  
  const { bookData, isbn } = route.params || {};
  
  // Form state
  const [bookType, setBookType] = useState('paperback');
  const [title, setTitle] = useState('');
  const [numberOfPages, setNumberOfPages] = useState('');
  const [currentPage, setCurrentPage] = useState('0');
  const [isbnValue, setIsbnValue] = useState('');
  const [yearPublished, setYearPublished] = useState('');
  const [review, setReview] = useState('');
  const [notes, setNotes] = useState('');
  const [stars, setStars] = useState(0);
  const [price, setPrice] = useState('');
  const [coverImage, setCoverImage] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  
  // Chip states
  const [authors, setAuthors] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [publishers, setPublishers] = useState<string[]>([]);
  
  // Menu states
  const [bookTypeMenuVisible, setBookTypeMenuVisible] = useState(false);
  const [authorMenuVisible, setAuthorMenuVisible] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [publisherMenuVisible, setPublisherMenuVisible] = useState(false);
  
  // Input states for adding new items
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPublisher, setNewPublisher] = useState('');
  
  // Existing data from database
  const [existingData, setExistingData] = useState<ExistingData>({
    authors: [],
    categories: [],
    publishers: []
  });
  
  const [loading, setLoading] = useState(false);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    initializeDatabase();
    initializeImageDirectories();
  }, []);

  useEffect(() => {
    if (db) {
      loadExistingData();
    }
  }, [db]);

  useEffect(() => {
    // Pre-populate fields if bookData is available
    if (bookData) {
      setTitle(bookData.title || '');
      setNumberOfPages(bookData.numberOfPages?.toString() || '');
      setIsbnValue(bookData.isbn_13 || bookData.isbn_10 || '');
      setYearPublished(bookData.publishYear?.toString() || '');
      
      // Set cover from OpenLibrary
      if (bookData.coverUrl) {
        setCoverUrl(bookData.coverUrl);
        setCoverImage(bookData.coverUrl);
      }
      
      // Set authors, categories, publishers from selected data
      if (bookData.authors) {
        setAuthors(bookData.authors);
      }
      if (bookData.selectedCategories) {
        setCategories(bookData.selectedCategories);
      } else if (bookData.subjects && bookData.subjects.length > 0) {
        setCategories([bookData.subjects.sort()[0]]);
      }
      if (bookData.selectedPublishers) {
        setPublishers(bookData.selectedPublishers);
      } else if (bookData.publishers && bookData.publishers.length > 0) {
        setPublishers([bookData.publishers.sort()[0]]);
      }
    } else if (isbn) {
      setIsbnValue(isbn);
    }
  }, [bookData, isbn]);

  const initializeDatabase = async () => {
    try {
      const database = await SQLite.openDatabaseAsync('RibbonDB.db');
      setDb(database);
    } catch (error) {
      console.error('Error opening database:', error);
      Alert.alert('Error', 'Failed to open database');
    }
  };

  const loadExistingData = async () => {
    if (!db) return;
    
    try {
      const authorsResult = await db.getAllAsync<{name: string}>('SELECT DISTINCT name FROM authors ORDER BY name');
      const categoriesResult = await db.getAllAsync<{name: string}>('SELECT DISTINCT name FROM categories ORDER BY name');
      const publishersResult = await db.getAllAsync<{name: string}>('SELECT DISTINCT name FROM publishers ORDER BY name');
      
      setExistingData({
        authors: authorsResult.map(row => row.name),
        categories: categoriesResult.map(row => row.name),
        publishers: publishersResult.map(row => row.name)
      });
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('addBook.permissionTitle'), t('addBook.permissionMessage'));
      return;
    }

    Alert.alert(
      t('addBook.selectImage'),
      t('addBook.selectImageMessage'),
      [
        { text: t('addBook.camera'), onPress: openCamera },
        { text: t('addBook.gallery'), onPress: openGallery },
        { text: t('common.cancel'), style: 'cancel' }
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('addBook.cameraPermissionTitle'), t('addBook.cameraPermissionMessage'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });

    if (!result.canceled) {
      setCoverImage(result.assets[0].uri);
      setCoverUrl(''); // Clear URL since we have local image
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: 'images',
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCoverImage(result.assets[0].uri);
      setCoverUrl(''); // Clear URL since we have local image
    }
  };

  const handleCoverImageSave = async (): Promise<string | null> => {
    if (!coverImage) return null;
    
    try {
      // If it's a local image (from camera/gallery), save it
      if (!coverImage.startsWith('http')) {
        return await saveLocalBookCover(coverImage);
      }
      
      // If it's a remote image (from OpenLibrary), cache it locally
      return await cacheRemoteBookCover(coverImage);
    } catch (error) {
      console.error('Error handling cover image:', error);
      return null;
    }
  };

  const addAuthor = (authorName?: string) => {
    const name = authorName || newAuthor.trim();
    if (name && !authors.includes(name)) {
      setAuthors([...authors, name]);
      setNewAuthor('');
    }
    setAuthorMenuVisible(false);
  };

  const removeAuthor = (author: string) => {
    setAuthors(authors.filter(a => a !== author));
  };

  const addCategory = (categoryName?: string) => {
    const name = categoryName || newCategory.trim();
    if (name && !categories.includes(name)) {
      setCategories([...categories, name]);
      setNewCategory('');
    }
    setCategoryMenuVisible(false);
  };

  const removeCategory = (category: string) => {
    setCategories(categories.filter(c => c !== category));
  };

  const addPublisher = (publisherName?: string) => {
    const name = publisherName || newPublisher.trim();
    if (name && !publishers.includes(name)) {
      setPublishers([...publishers, name]);
      setNewPublisher('');
    }
    setPublisherMenuVisible(false);
  };

  const removePublisher = (publisher: string) => {
    setPublishers(publishers.filter(p => p !== publisher));
  };

  const getAvailableAuthors = () => {
    return existingData.authors.filter(author => !authors.includes(author));
  };

  const getAvailableCategories = () => {
    return existingData.categories.filter(category => !categories.includes(category));
  };

  const getAvailablePublishers = () => {
    return existingData.publishers.filter(publisher => !publishers.includes(publisher));
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setStars(star)}
            style={styles.starButton}
          >
            <Text style={[
              styles.star,
              { color: star <= stars ? '#FFD700' : theme.colors.outline }
            ]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderCoverSection = () => {
    // Styled like LibraryBookDetails cover section
    return (
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.bookCover')}
        </Text>
        <View style={styles.coverSection}>
          {coverImage ? (
            <View style={styles.coverContainer}>
              <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" />
              <IconButton
                icon="close"
                iconColor={theme.colors.onError}
                containerColor={theme.colors.error}
                size={20}
                style={styles.removeCoverIconButton}
                onPress={() => {
                  setCoverImage('');
                  setCoverUrl('');
                }}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={pickImage}
            >
              <IconButton
                icon="camera-plus"
                size={scale(40)}
                iconColor={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
          {coverImage && (
            <Button
              mode="contained"
              onPress={pickImage}
              style={styles.changeCoverButton}
              contentStyle={styles.saveButtonContent}
              icon="image-edit"
              textColor={'#FFFFFF'}
            >
              {t('addBook.changeCover') || 'Change Cover'}
            </Button>
          )}
        </View>
      </Surface>
    );
  };

  const getOrCreateAuthor = async (name: string): Promise<number> => {
    if (!db) throw new Error('Database not initialized');
    
    // Check if author exists
    const existingAuthor = await db.getFirstAsync<{author_id: number}>(
      'SELECT author_id FROM authors WHERE name = ?', [name]
    );
    
    if (existingAuthor) {
      return existingAuthor.author_id;
    }
    
    // Create new author
    const result = await db.runAsync('INSERT INTO authors (name) VALUES (?)', [name]);
    return result.lastInsertRowId;
  };

  const getOrCreateCategory = async (name: string): Promise<number> => {
    if (!db) throw new Error('Database not initialized');
    
    // Check if category exists
    const existingCategory = await db.getFirstAsync<{category_id: number}>(
      'SELECT category_id FROM categories WHERE name = ?', [name]
    );
    
    if (existingCategory) {
      return existingCategory.category_id;
    }
    
    // Create new category
    const result = await db.runAsync('INSERT INTO categories (name) VALUES (?)', [name]);
    return result.lastInsertRowId;
  };

  const getOrCreatePublisher = async (name: string): Promise<number> => {
    if (!db) throw new Error('Database not initialized');
    
    // Check if publisher exists
    const existingPublisher = await db.getFirstAsync<{publisher_id: number}>(
      'SELECT publisher_id FROM publishers WHERE name = ?', [name]
    );
    
    if (existingPublisher) {
      return existingPublisher.publisher_id;
    }
    
    // Create new publisher
    const result = await db.runAsync('INSERT INTO publishers (name) VALUES (?)', [name]);
    return result.lastInsertRowId;
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t('addBook.validationError'), t('addBook.titleRequired'));
      return false;
    }
    
    if (!numberOfPages || parseInt(numberOfPages) <= 0) {
      Alert.alert(t('addBook.validationError'), t('addBook.pagesRequired'));
      return false;
    }
    
    if (currentPage && parseInt(currentPage) < 0) {
      Alert.alert(t('addBook.validationError'), t('addBook.currentPageInvalid') || 'Current page cannot be negative');
      return false;
    }
    if (currentPage && numberOfPages && parseInt(currentPage) > parseInt(numberOfPages)) {
      Alert.alert(t('addBook.validationError'), t('addBook.currentPageTooHigh') || 'Current page cannot exceed total pages');
      return false;
    }
    
    if (authors.length === 0) {
      Alert.alert(t('addBook.validationError'), t('addBook.authorRequired'));
      return false;
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !db) return;
    
    setLoading(true);
    
    try {
      // Save cover image if exists
      const localCoverPath = await handleCoverImageSave();
      
      // Insert book
      const bookResult = await db.runAsync(`
        INSERT INTO books (
          book_type, title, cover_url, cover_path, number_of_pages, current_page, isbn, 
          openlibrary_code, year_published, review, notes, stars, price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        bookType,
        title.trim(),
        coverUrl || null,
        localCoverPath || null,
        parseInt(numberOfPages),
        currentPage ? parseInt(currentPage) : 0,
        isbnValue.trim() || null,
        bookData?.openLibraryKey || null,
        yearPublished ? parseInt(yearPublished) : null,
        review.trim() || null,
        notes.trim() || null,
        stars > 0 ? stars : null,
        price ? parseFloat(price) : null
      ]);
      
      const bookId = bookResult.lastInsertRowId;
      
      // Add authors
      for (const authorName of authors) {
        const authorId = await getOrCreateAuthor(authorName);
        await db.runAsync('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [bookId, authorId]);
      }
      
      // Add categories
      for (const categoryName of categories) {
        const categoryId = await getOrCreateCategory(categoryName);
        await db.runAsync('INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', [bookId, categoryId]);
      }
      
      // Add publishers
      for (const publisherName of publishers) {
        const publisherId = await getOrCreatePublisher(publisherName);
        await db.runAsync('INSERT INTO book_publishers (book_id, publisher_id) VALUES (?, ?)', [bookId, publisherId]);
      }
      
      
    } catch (error) {
      console.error('Error saving book:', error);
      Alert.alert(t('addBook.error'), t('addBook.errorMessage'));
    } finally {
      setLoading(false);
      navigation.navigate('Library');
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover Section (Surface styled) */}
      {renderCoverSection()}

      {/* Book Type */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.bookType')}
        </Text>
        <Menu
          visible={bookTypeMenuVisible}
          onDismiss={() => setBookTypeMenuVisible(false)}
          anchor={
            <Button
              mode="contained"
              onPress={() => setBookTypeMenuVisible(true)}
              style={styles.menuButton}
              contentStyle={styles.saveButtonContent}
              icon="chevron-down"
              textColor={'#FFFFFF'}
            >
              {t(`addBook.${bookType}`)}
            </Button>
          }
        >
          {BOOK_TYPES.map((type) => (
            <Menu.Item
              key={type.key}
              onPress={() => {
                setBookType(type.key);
                setBookTypeMenuVisible(false);
              }}
              title={t(`addBook.${type.key}`)}
            />
          ))}
        </Menu>
      </Surface>

      {/* Title */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.title')}
        </Text>
        <TextInput
          mode="outlined"
          label={t('addBook.title')}
          value={title}
          onChangeText={setTitle}
          style={styles.textInput}
        />
      </Surface>


      {/* Authors Section */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.authors')}
        </Text>
        
        <View style={styles.chipsContainer}>
          {authors.map((author, index) => (
            <Chip
              key={index}
              onClose={() => removeAuthor(author)}
              style={styles.chip}
            >
              {author}
            </Chip>
          ))}
        </View>

        <Menu
          visible={authorMenuVisible}
          onDismiss={() => setAuthorMenuVisible(false)}
          anchor={
            <Button
              mode="contained"
              onPress={() => setAuthorMenuVisible(true)}
              icon="plus"
              style={styles.addButton}
              contentStyle={styles.saveButtonContent}
              textColor={'#FFFFFF'}
            >
              {t('addBook.addAuthor')}
            </Button>
          }
        >
          {/* Existing authors */}
          {getAvailableAuthors().length > 0 ? (
            getAvailableAuthors().map((author) => (
              <Menu.Item
                key={author}
                onPress={() => addAuthor(author)}
                title={author}
              />
            ))
          ) : (
            <Menu.Item
              key="no-authors"
              title={t('addBook.noAuthorsFound')}
              disabled
            />
          )}
          <Divider />
          {/* Add new author */}
          <View style={styles.menuInputContainer}>
            <TextInput
              mode="outlined"
              label={t('addBook.newAuthor')}
              value={newAuthor}
              onChangeText={setNewAuthor}
              style={styles.menuInput}
              dense
            />
            <Button
              mode="contained"
              onPress={() => addAuthor()}
              disabled={!newAuthor.trim()}
              compact
            >
              {t('common.add')}
            </Button>
          </View>
        </Menu>
      </Surface>

      {/* Categories Section */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.categories')}
        </Text>
        
        <View style={styles.chipsContainer}>
          {categories.map((category, index) => (
            <Chip
              key={index}
              onClose={() => removeCategory(category)}
              style={styles.chip}
            >
              {category}
            </Chip>
          ))}
        </View>

        <Menu
          visible={categoryMenuVisible}
          onDismiss={() => setCategoryMenuVisible(false)}
          anchor={
            <Button
              mode="contained"
              onPress={() => setCategoryMenuVisible(true)}
              icon="plus"
              style={styles.addButton}
              contentStyle={styles.saveButtonContent}
              textColor={'#FFFFFF'}
            >
              {t('addBook.addCategory')}
            </Button>
          }
        >
          {/* Existing categories */}
          {getAvailableCategories().length > 0 ? (
            getAvailableCategories().map((category) => (
              <Menu.Item
                key={category}
                onPress={() => addCategory(category)}
                title={category}
              />
            ))
          ) : (
            <Menu.Item
              key="no-categories"
              title={t('addBook.noCategoriesFound')}
              disabled
            />
          )}
          <Divider />
          {/* Add new category */}
          <View style={styles.menuInputContainer}>
            <TextInput
              mode="outlined"
              label={t('addBook.newCategory')}
              value={newCategory}
              onChangeText={setNewCategory}
              style={styles.menuInput}
              dense
            />
            <Button
              mode="contained"
              onPress={() => addCategory()}
              disabled={!newCategory.trim()}
              compact
            >
              {t('common.add')}
            </Button>
          </View>
        </Menu>
      </Surface>

      {/* Publishers Section */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.publishers')}
        </Text>
        
        <View style={styles.chipsContainer}>
          {publishers.map((publisher, index) => (
            <Chip
              key={index}
              onClose={() => removePublisher(publisher)}
              style={styles.chip}
            >
              {publisher}
            </Chip>
          ))}
        </View>

        <Menu
          visible={publisherMenuVisible}
          onDismiss={() => setPublisherMenuVisible(false)}
          anchor={
            <Button
              mode="contained"
              onPress={() => setPublisherMenuVisible(true)}
              icon="plus"
              style={styles.addButton}
              contentStyle={styles.saveButtonContent}
              textColor={'#FFFFFF'}
            >
              {t('addBook.addPublisher')}
            </Button>
          }
        >
          {/* Existing publishers */}
          {getAvailablePublishers().length > 0 ? (
            getAvailablePublishers().map((publisher) => (
              <Menu.Item
                key={publisher}
                onPress={() => addPublisher(publisher)}
                title={publisher}
              />
            ))
          ) : (
            <Menu.Item
              key="no-publishers"
              title={t('addBook.noPublishersFound')}
              disabled
            />
          )}
          <Divider />
          {/* Add new publisher */}
          <View style={styles.menuInputContainer}>
            <TextInput
              mode="outlined"
              label={t('addBook.newPublisher')}
              value={newPublisher}
              onChangeText={setNewPublisher}
              style={styles.menuInput}
              dense
            />
            <Button
              mode="contained"
              onPress={() => addPublisher()}
              disabled={!newPublisher.trim()}
              compact
            >
              {t('common.add')}
            </Button>
          </View>
        </Menu>
      </Surface>

      {/* Book Details (moved below publishers) */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.basicInfo')}
        </Text>
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <TextInput
              mode="outlined"
              label={t('addBook.numberOfPages')}
              value={numberOfPages}
              onChangeText={setNumberOfPages}
              keyboardType="numeric"
              style={styles.textInput}
            />
          </View>
          <View style={styles.halfWidth}>
            <TextInput
              mode="outlined"
              label={t('addBook.currentPage') || t('bookDetails.currentPage')}
              value={currentPage}
              onChangeText={setCurrentPage}
              keyboardType="numeric"
              style={styles.textInput}
            />
          </View>
        </View>
        <TextInput
          mode="outlined"
          label={t('addBook.isbn')}
          value={isbnValue}
          onChangeText={setIsbnValue}
          style={styles.textInput}
        />
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <TextInput
              mode="outlined"
              label={t('addBook.yearPublished')}
              value={yearPublished}
              onChangeText={setYearPublished}
              keyboardType="numeric"
              style={styles.textInput}
            />
          </View>
          <View style={styles.halfWidth}>
            <TextInput
              mode="outlined"
              label={t('addBook.price')}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              style={styles.textInput}
            />
          </View>
        </View>
      </Surface>

      {/* Review & Notes Section (without price, mirroring LibraryBookDetails) */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.reviewNotes')}
        </Text>
        <TextInput
          mode="outlined"
          label={t('addBook.review')}
          value={review}
          onChangeText={setReview}
          multiline
          numberOfLines={3}
          style={[styles.textInput, styles.textArea]}
        />
        <TextInput
          mode="outlined"
          label={t('addBook.notes')}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={[styles.textInput, styles.textArea]}
        />
      </Surface>

      {/* Rating Section */}
      <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {t('addBook.rating')}
        </Text>
        
        {renderStars()}
      </Surface>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <Button
          mode="contained"
          onPress={handleSave}
          disabled={loading}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>{t('addBook.saveBook')}</Text>
          )}
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(32),
  },
  coverSection: {
    alignItems: 'center',
  },
  coverContainer: {
    position: 'relative',
    marginBottom: scale(12),
  width: COVER_WIDTH,
  height: COVER_HEIGHT,
  },
  coverPlaceholder: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  removeCoverIconButton: {
    position: 'absolute',
    top: -scale(10),
    right: -scale(10),
  },
  changeCoverButton: {
    marginTop: scale(8),
  },
  coverImage: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(8),
  },
  coverPlaceholderText: {
    marginTop: scale(8),
    fontSize: scale(14),
    textAlign: 'center',
  },
  removeCoverButton: {
    marginTop: scale(8),
  },
  section: {
    margin: scale(16),
    marginTop: scale(8),
    padding: scale(16),
    borderRadius: scale(12),
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: scale(16),
  },
  textInput: {
    marginBottom: scale(12),
  },
  textArea: {
    minHeight: scale(80),
  },
  row: {
    flexDirection: 'row',
    gap: scale(12),
  },
  halfWidth: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: scale(8),
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  starButton: {
    padding: scale(4),
  },
  star: {
    fontSize: scale(24),
  },
  starText: {
    marginLeft: scale(8),
    fontSize: scale(14),
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: scale(12),
    gap: scale(8),
  },
  chip: {
    marginRight: scale(4),
    marginBottom: scale(4),
  },
  addButton: {
    marginBottom: scale(8),
  },
  menuInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(16),
    gap: scale(8),
  },
  menuInput: {
    flex: 1,
  },
  saveButtonContainer: {
    margin: scale(16),
    marginBottom: scale(32),
  },
  saveButton: {
    paddingVertical: scale(4),
    borderRadius: scale(8),
  },
  saveButtonContent: {
    height: scale(48),
  },
  saveButtonText: {
    color: 'white',
    fontSize: scale(16),
    fontWeight: '600',
  },
  menuButton: {
    marginBottom: scale(8),
  },
});
