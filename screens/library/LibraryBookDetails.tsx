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
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { 
  saveLocalBookCover, 
  cacheRemoteBookCover, 
  deleteOldCover, 
  getCoverImageUri,
  initializeImageDirectories 
} from '../../utils/imageUtils';

type LibraryBookDetailsRouteProp = RouteProp<LibraryStackParamList, 'LibraryBookDetails'>;
type LibraryBookDetailsNavigationProp = StackNavigationProp<LibraryStackParamList, 'LibraryBookDetails'>;

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

interface LibraryBook {
  book_id: number;
  book_type: string;
  title: string;
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  isbn?: string;
  year_published?: number;
  current_page: number;
  review?: string;
  notes?: string;
  stars?: number;
  price?: number;
  authors: string[];
  categories: string[];
  publishers: string[];
}

export default function LibraryBookDetails() {
  const { theme } = useTheme();
  const navigation = useNavigation<LibraryBookDetailsNavigationProp>();
  const route = useRoute<LibraryBookDetailsRouteProp>();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  
  const { bookId } = route.params;
  
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
  const [originalCoverPath, setOriginalCoverPath] = useState<string>('');  // Track original for cleanup
  
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
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBookData();
    loadExistingData();
    initializeImageDirectories();
  }, []);

  const loadBookData = async () => {
    try {
      setLoading(true);
      
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
      `, [bookId]);

      if (bookResult) {
        const book: LibraryBook = {
          ...bookResult,
          authors: bookResult.authors ? bookResult.authors.split(',') : [],
          categories: bookResult.categories ? bookResult.categories.split(',') : [],
          publishers: bookResult.publishers ? bookResult.publishers.split(',') : []
        };

        // Populate form fields
        setBookType(book.book_type);
        setTitle(book.title);
        setNumberOfPages(book.number_of_pages.toString());
        setCurrentPage(book.current_page.toString());
        setIsbnValue(book.isbn || '');
        setYearPublished(book.year_published?.toString() || '');
        setReview(book.review || '');
        setNotes(book.notes || '');
        setStars(book.stars || 0);
        setPrice(book.price?.toString() || '');
        setCoverUrl(book.cover_url || '');
        setCoverImage(book.cover_path || book.cover_url || '');
        setOriginalCoverPath(book.cover_path || '');  // Store original for cleanup
        setAuthors(book.authors);
        setCategories(book.categories);
        setPublishers(book.publishers);
      } else {
        Alert.alert('Error', 'Book not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading book data:', error);
      Alert.alert('Error', 'Failed to load book data');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingData = async () => {
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
        { text: t('scanner.cancel'), style: 'cancel' }
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
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
      setCoverUrl(''); // Clear cover URL since we're using local image
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
      setCoverUrl(''); // Clear cover URL since we're using local image
    }
  };

  const removeCoverImage = () => {
    setCoverImage('');
    setCoverUrl('');
  };

  const handleImageSave = async (uri: string): Promise<string | null> => {
    try {
      if (!uri.startsWith('http')) {
        // Local image (from camera/gallery)
        return await saveLocalBookCover(uri, bookId);
      } else {
        // Remote image (cache it locally)
        return await cacheRemoteBookCover(uri, bookId);
      }
    } catch (error) {
      console.error('Error handling image save:', error);
      return null;
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t('addBook.validationError'), t('addBook.titleRequired'));
      return false;
    }
    if (authors.length === 0) {
      Alert.alert(t('addBook.validationError'), t('addBook.authorRequired'));
      return false;
    }
    if (!numberOfPages.trim() || isNaN(Number(numberOfPages)) || Number(numberOfPages) <= 0) {
      Alert.alert(t('addBook.validationError'), t('addBook.pagesRequired'));
      return false;
    }
    if (currentPage && (isNaN(Number(currentPage)) || Number(currentPage) < 0 || Number(currentPage) > Number(numberOfPages))) {
      Alert.alert('Validation Error', 'Current page must be between 0 and total pages');
      return false;
    }
    return true;
  };

  const updateBook = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      let coverPath = coverImage;
      
      // Save cover image if it's a local URI (not a URL or existing path)
      if (coverImage && (coverImage.startsWith('file://') || coverImage.startsWith('content://'))) {
        const savedPath = await handleImageSave(coverImage);
        if (savedPath) {
          coverPath = savedPath;
          
          // Delete old cover if we saved a new one
          if (originalCoverPath && originalCoverPath !== savedPath) {
            await deleteOldCover(originalCoverPath);
          }
        }
      } else if (coverImage && coverImage.startsWith('http')) {
        // If we have a remote URL, cache it locally
        const cachedPath = await cacheRemoteBookCover(coverImage, bookId);
        if (cachedPath) {
          coverPath = cachedPath;
          
          // Delete old cover if we cached a new one
          if (originalCoverPath && originalCoverPath !== cachedPath) {
            await deleteOldCover(originalCoverPath);
          }
        }
      }

      // Update the book
      await db.runAsync(`
        UPDATE books 
        SET book_type = ?, title = ?, cover_url = ?, cover_path = ?, 
            number_of_pages = ?, isbn = ?, year_published = ?, 
            current_page = ?, review = ?, notes = ?, stars = ?, price = ?
        WHERE book_id = ?
      `, [
        bookType,
        title.trim(),
        coverUrl || null,
        (coverPath && !coverPath.startsWith('http')) ? coverPath : null,
        Number(numberOfPages),
        isbnValue.trim() || null,
        yearPublished ? Number(yearPublished) : null,
        Number(currentPage),
        review.trim() || null,
        notes.trim() || null,
        stars || null,
        price ? Number(price) : null,
        bookId
      ]);

      // Update authors
      await db.runAsync('DELETE FROM book_authors WHERE book_id = ?', [bookId]);
      for (const authorName of authors) {
        let authorId = await insertOrGetAuthor(authorName);
        await db.runAsync('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)', [bookId, authorId]);
      }

      // Update categories
      await db.runAsync('DELETE FROM book_categories WHERE book_id = ?', [bookId]);
      for (const categoryName of categories) {
        let categoryId = await insertOrGetCategory(categoryName);
        await db.runAsync('INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', [bookId, categoryId]);
      }

      // Update publishers
      await db.runAsync('DELETE FROM book_publishers WHERE book_id = ?', [bookId]);
      for (const publisherName of publishers) {
        let publisherId = await insertOrGetPublisher(publisherName);
        await db.runAsync('INSERT INTO book_publishers (book_id, publisher_id) VALUES (?, ?)', [bookId, publisherId]);
      }

      Alert.alert(
        t('addBook.success'),
        'Book has been updated successfully!',
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('Error updating book:', error);
      Alert.alert(t('addBook.error'), 'Failed to update the book. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const insertOrGetAuthor = async (name: string): Promise<number> => {
    const insertResult = await db.runAsync('INSERT OR IGNORE INTO authors (name) VALUES (?)', [name]);
    if (insertResult.changes > 0) {
      return insertResult.lastInsertRowId;
    } else {
      const existingAuthor = await db.getFirstAsync<{ author_id: number }>('SELECT author_id FROM authors WHERE name = ?', [name]);
      return existingAuthor!.author_id;
    }
  };

  const insertOrGetCategory = async (name: string): Promise<number> => {
    const insertResult = await db.runAsync('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name]);
    if (insertResult.changes > 0) {
      return insertResult.lastInsertRowId;
    } else {
      const existingCategory = await db.getFirstAsync<{ category_id: number }>('SELECT category_id FROM categories WHERE name = ?', [name]);
      return existingCategory!.category_id;
    }
  };

  const insertOrGetPublisher = async (name: string): Promise<number> => {
    const insertResult = await db.runAsync('INSERT OR IGNORE INTO publishers (name) VALUES (?)', [name]);
    if (insertResult.changes > 0) {
      return insertResult.lastInsertRowId;
    } else {
      const existingPublisher = await db.getFirstAsync<{ publisher_id: number }>('SELECT publisher_id FROM publishers WHERE name = ?', [name]);
      return existingPublisher!.publisher_id;
    }
  };

  // Chip management functions
  const addAuthor = (authorName: string) => {
    if (authorName.trim() && !authors.includes(authorName.trim())) {
      setAuthors([...authors, authorName.trim()]);
    }
    setNewAuthor('');
    setAuthorMenuVisible(false);
  };

  const removeAuthor = (authorToRemove: string) => {
    setAuthors(authors.filter(author => author !== authorToRemove));
  };

  const addCategory = (categoryName: string) => {
    if (categoryName.trim() && !categories.includes(categoryName.trim())) {
      setCategories([...categories, categoryName.trim()]);
    }
    setNewCategory('');
    setCategoryMenuVisible(false);
  };

  const removeCategory = (categoryToRemove: string) => {
    setCategories(categories.filter(category => category !== categoryToRemove));
  };

  const addPublisher = (publisherName: string) => {
    if (publisherName.trim() && !publishers.includes(publisherName.trim())) {
      setPublishers([...publishers, publisherName.trim()]);
    }
    setNewPublisher('');
    setPublisherMenuVisible(false);
  };

  const removePublisher = (publisherToRemove: string) => {
    setPublishers(publishers.filter(publisher => publisher !== publisherToRemove));
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setStars(star)}>
            <Text style={[
              styles.star, 
              { color: star <= stars ? theme.colors.primary : theme.colors.outline }
            ]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setStars(0)} style={styles.clearStarsButton}>
          <Text style={[styles.clearStarsText, { color: theme.colors.outline }]}>Clear</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
          Loading book details...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Book Cover Section */}
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
                  style={styles.removeCoverButton}
                  onPress={removeCoverImage}
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
                Change Cover
              </Button>
            )}
          </View>
        </Surface>

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
                {t(`addBook.bookTypes.${bookType}`)}
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
                title={t(`addBook.bookTypes.${type.key}`)}
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
            value={title}
            onChangeText={setTitle}
            placeholder={t('addBook.titlePlaceholder')}
            style={styles.input}
          />
        </Surface>

        {/* Authors */}
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('addBook.authors')}
          </Text>
          
          
          
          <View style={styles.chipsContainer}>
            {authors.map((author) => (
              <Chip
                key={author}
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
            <View style={styles.menuContent}>
              <TextInput
                mode="outlined"
                value={newAuthor}
                onChangeText={setNewAuthor}
                placeholder={t('addBook.authorName')}
                style={styles.menuInput}
                right={
                  <TextInput.Icon 
                    icon="plus" 
                    onPress={() => addAuthor(newAuthor)}
                    disabled={!newAuthor.trim()}
                  />
                }
              />
              <Divider style={styles.menuDivider} />
              {existingData.authors.length > 0 ? (
                existingData.authors
                  .filter(author => !authors.includes(author))
                  .map(author => (
                    <Menu.Item
                      key={author}
                      onPress={() => addAuthor(author)}
                      title={author}
                    />
                  ))
              ) : (
                <Menu.Item title={t('addBook.noAuthorsFound')} disabled />
              )}
            </View>
          </Menu>
        </Surface>

        {/* Categories */}
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('addBook.categories')}
          </Text>
          {/* Chips first */}
          <View style={styles.chipsContainer}>
            {categories.map((category) => (
              <Chip
                key={category}
                onClose={() => removeCategory(category)}
                style={styles.chip}
              >
                {category}
              </Chip>
            ))}
          </View>

          {/* Add Category Button (contained) below chips */}
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
            <View style={styles.menuContent}>
              <TextInput
                mode="outlined"
                value={newCategory}
                onChangeText={setNewCategory}
                placeholder={t('addBook.categoryName')}
                style={styles.menuInput}
                right={
                  <TextInput.Icon 
                    icon="plus" 
                    onPress={() => addCategory(newCategory)}
                    disabled={!newCategory.trim()}
                  />
                }
              />
              <Divider style={styles.menuDivider} />
              {existingData.categories.length > 0 ? (
                existingData.categories
                  .filter(category => !categories.includes(category))
                  .map(category => (
                    <Menu.Item
                      key={category}
                      onPress={() => addCategory(category)}
                      title={category}
                    />
                  ))
              ) : (
                <Menu.Item title={t('addBook.noCategoriesFound')} disabled />
              )}
            </View>
          </Menu>
        </Surface>

        {/* Publishers */}
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('addBook.publishers')}
          </Text>
          {/* Chips first */}
          <View style={styles.chipsContainer}>
            {publishers.map((publisher) => (
              <Chip
                key={publisher}
                onClose={() => removePublisher(publisher)}
                style={styles.chip}
              >
                {publisher}
              </Chip>
            ))}
          </View>

          {/* Add Publisher Button (contained) below chips */}
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
            <View style={styles.menuContent}>
              <TextInput
                mode="outlined"
                value={newPublisher}
                onChangeText={setNewPublisher}
                placeholder={t('addBook.publisherName')}
                style={styles.menuInput}
                right={
                  <TextInput.Icon 
                    icon="plus" 
                    onPress={() => addPublisher(newPublisher)}
                    disabled={!newPublisher.trim()}
                  />
                }
              />
              <Divider style={styles.menuDivider} />
              {existingData.publishers.length > 0 ? (
                existingData.publishers
                  .filter(publisher => !publishers.includes(publisher))
                  .map(publisher => (
                    <Menu.Item
                      key={publisher}
                      onPress={() => addPublisher(publisher)}
                      title={publisher}
                    />
                  ))
              ) : (
                <Menu.Item title={t('addBook.noPublishersFound')} disabled />
              )}
            </View>
          </Menu>
        </Surface>

        {/* Book Details */}
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Book Details
          </Text>
          
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <TextInput
                mode="outlined"
                label={t('addBook.numberOfPages')}
                value={numberOfPages}
                onChangeText={setNumberOfPages}
                placeholder={t('addBook.pagesPlaceholder')}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={styles.halfWidth}>
              <TextInput
                mode="outlined"
                label="Current Page"
                value={currentPage}
                onChangeText={setCurrentPage}
                placeholder="Enter current page"
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <TextInput
            mode="outlined"
            label={t('addBook.isbn')}
            value={isbnValue}
            onChangeText={setIsbnValue}
            placeholder={t('addBook.isbnPlaceholder')}
            style={styles.input}
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <TextInput
                mode="outlined"
                label={t('addBook.yearPublished')}
                value={yearPublished}
                onChangeText={setYearPublished}
                placeholder={t('addBook.yearPlaceholder')}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={styles.halfWidth}>
              <TextInput
                mode="outlined"
                label={t('addBook.price')}
                value={price}
                onChangeText={setPrice}
                placeholder={t('addBook.pricePlaceholder')}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>
        </Surface>

        {/* Rating & Review */}
        <Surface style={[styles.section, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            {t('addBook.reviewNotes')}
          </Text>
          
          <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.onSurface }]}>
            {t('addBook.rating')}
          </Text>
          {renderStars()}

          <TextInput
            mode="outlined"
            label={t('addBook.review')}
            value={review}
            onChangeText={setReview}
            placeholder={t('addBook.reviewPlaceholder')}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />

          <TextInput
            mode="outlined"
            label={t('addBook.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('addBook.notesPlaceholder')}
            multiline
            numberOfLines={3}
            style={[styles.input, styles.textArea]}
          />
        </Surface>

        {/* Update Button */}
        <Button
          mode="contained"
          onPress={updateBook}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          textColor={'#FFFFFF'}
        >
          Update Book
        </Button>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: scale(16),
    paddingBottom: scale(32),
  },
  section: {
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: scale(16),
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: scale(12),
  },
  input: {
    marginBottom: scale(8),
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
  menuButton: {
    marginBottom: scale(8),
  },
  menuButtonContent: {
    height: scale(48),
  },
  addButton: {
    marginBottom: scale(12),
    marginTop: scale(12),
  },
  menuContent: {
    padding: scale(8),
    maxWidth: scale(300),
  },
  menuInput: {
    marginBottom: scale(8),
  },
  menuDivider: {
    marginBottom: scale(8),
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    marginBottom: scale(4),
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  star: {
    fontSize: scale(32),
    marginRight: scale(4),
  },
  clearStarsButton: {
    marginLeft: scale(12),
    padding: scale(4),
  },
  clearStarsText: {
    fontSize: scale(12),
  },
  label: {
    marginBottom: scale(8),
  },
  coverSection: {
    alignItems: 'center',
  },
  coverContainer: {
    position: 'relative',
    marginBottom: scale(12),
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  coverPlaceholderText: {
    textAlign: 'center',
    fontSize: scale(14),
  },
  removeCoverButton: {
    position: 'absolute',
    top: -scale(10),
    right: -scale(10),
  },
  changeCoverButton: {
    marginTop: scale(8),
  },
  saveButton: {
    marginTop: scale(16),
  },
  saveButtonContent: {
    height: scale(48),
  },
  loadingText: {
    marginTop: scale(16),
    fontSize: scale(16),
  },
});
