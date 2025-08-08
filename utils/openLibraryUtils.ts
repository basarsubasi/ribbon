export interface OpenLibrarySearchResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
  subject?: string[];
  number_of_pages_median?: number;
}

export interface OpenLibraryBookDetails {
  key: string;
  title: string;
  authors?: Array<{
    name: string;
    key: string;
  }>;
  subjects?: string[];
  publishers?: string[];
  publish_date?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  number_of_pages?: number;
  covers?: number[];
  description?: string | { value: string };
  first_publish_date?: string;
}

export interface ProcessedBookData {
  title: string;
  authors: string[];
  isbn_13?: string;
  isbn_10?: string;
  publishYear?: number;
  publishers: string[];
  subjects: string[];
  numberOfPages?: number;
  coverUrl?: string;
  description?: string;
  openLibraryKey: string;
  selectedPublishers?: string[];
  selectedCategories?: string[];
}

const OPENLIBRARY_BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org/b';

/**
 * Search for books in OpenLibrary by query string
 */
export async function searchBooks(query: string, limit: number = 10): Promise<OpenLibrarySearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `${OPENLIBRARY_BASE_URL}/search.json?q=${encodedQuery}&limit=${limit}&fields=key,title,author_name,first_publish_year,isbn,cover_i,publisher,subject,number_of_pages_median`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.docs || [];
  } catch (error) {
    console.error('Error searching books:', error);
    throw new Error('Failed to search books');
  }
}

/**
 * Search for books by ISBN
 */
export async function searchBooksByISBN(isbn: string): Promise<OpenLibrarySearchResult[]> {
  try {
    const cleanISBN = isbn.replace(/[-\s]/g, '');
    const response = await fetch(
      `${OPENLIBRARY_BASE_URL}/search.json?isbn=${cleanISBN}&fields=key,title,author_name,first_publish_year,isbn,cover_i,publisher,subject,number_of_pages_median`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.docs || [];
  } catch (error) {
    console.error('Error searching books by ISBN:', error);
    throw new Error('Failed to search books by ISBN');
  }
}

/**
 * Get detailed book information by OpenLibrary key
 */
export async function getBookDetails(bookKey: string): Promise<OpenLibraryBookDetails> {
  try {
    // Remove leading slash if present
    const cleanKey = bookKey.startsWith('/') ? bookKey : `/${bookKey}`;
    
    const response = await fetch(`${OPENLIBRARY_BASE_URL}${cleanKey}.json`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Fetch author details if available
    if (data.authors && Array.isArray(data.authors)) {
      const authorPromises = data.authors.map(async (author: any) => {
        try {
          const authorKey = typeof author === 'string' ? author : author.author?.key || author.key;
          if (authorKey) {
            const authorResponse = await fetch(`${OPENLIBRARY_BASE_URL}${authorKey}.json`);
            const authorData = await authorResponse.json();
            return {
              name: authorData.name || 'Unknown Author',
              key: authorKey
            };
          }
        } catch (error) {
          console.warn('Error fetching author details:', error);
        }
        return {
          name: 'Unknown Author',
          key: author.key || ''
        };
      });

      data.authors = await Promise.all(authorPromises);
    }

    return data;
  } catch (error) {
    console.error('Error fetching book details:', error);
    throw new Error('Failed to fetch book details');
  }
}

/**
 * Get cover image URL by cover ID
 */
export function getCoverImageUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `${COVERS_BASE_URL}/id/${coverId}-${size}.jpg`;
}

/**
 * Get cover image URL by ISBN
 */
export function getCoverImageUrlByISBN(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
  const cleanISBN = isbn.replace(/[-\s]/g, '');
  return `${COVERS_BASE_URL}/isbn/${cleanISBN}-${size}.jpg`;
}

/**
 * Process OpenLibrary book data into a standardized format
 */
export function processBookData(searchResult: OpenLibrarySearchResult, bookDetails?: OpenLibraryBookDetails): ProcessedBookData {
  const processed: ProcessedBookData = {
    title: bookDetails?.title || searchResult.title,
    authors: [],
    publishers: [],
    subjects: [],
    openLibraryKey: bookDetails?.key || searchResult.key
  };

  // Process authors
  if (bookDetails?.authors) {
    processed.authors = bookDetails.authors.map(author => author.name);
  } else if (searchResult.author_name) {
    processed.authors = searchResult.author_name;
  }

  // Process ISBN
  if (bookDetails?.isbn_13 && bookDetails.isbn_13.length > 0) {
    processed.isbn_13 = bookDetails.isbn_13[0];
  } else if (bookDetails?.isbn_10 && bookDetails.isbn_10.length > 0) {
    processed.isbn_10 = bookDetails.isbn_10[0];
  } else if (searchResult.isbn && searchResult.isbn.length > 0) {
    // Try to determine if it's ISBN-13 or ISBN-10
    const isbn = searchResult.isbn[0];
    if (isbn.length === 13 || (isbn.length === 17 && isbn.includes('-'))) {
      processed.isbn_13 = isbn;
    } else {
      processed.isbn_10 = isbn;
    }
  }

  // Process publication year
  if (bookDetails?.publish_date) {
    const year = parseInt(bookDetails.publish_date.match(/\d{4}/)?.[0] || '0');
    if (year > 0) processed.publishYear = year;
  } else if (searchResult.first_publish_year) {
    processed.publishYear = searchResult.first_publish_year;
  }

  // Process publishers
  if (bookDetails?.publishers) {
    processed.publishers = bookDetails.publishers;
  } else if (searchResult.publisher) {
    processed.publishers = searchResult.publisher;
  }

  // Process subjects/categories
  if (bookDetails?.subjects) {
    processed.subjects = bookDetails.subjects.slice(0, 5); // Limit to first 5 subjects
  } else if (searchResult.subject) {
    processed.subjects = searchResult.subject.slice(0, 5);
  }

  // Process number of pages
  if (bookDetails?.number_of_pages) {
    processed.numberOfPages = bookDetails.number_of_pages;
  } else if (searchResult.number_of_pages_median) {
    processed.numberOfPages = searchResult.number_of_pages_median;
  }

  // Process cover image
  if (bookDetails?.covers && bookDetails.covers.length > 0) {
    processed.coverUrl = getCoverImageUrl(bookDetails.covers[0], 'L');
  } else if (searchResult.cover_i) {
    processed.coverUrl = getCoverImageUrl(searchResult.cover_i, 'L');
  } else if (processed.isbn_13) {
    processed.coverUrl = getCoverImageUrlByISBN(processed.isbn_13, 'L');
  } else if (processed.isbn_10) {
    processed.coverUrl = getCoverImageUrlByISBN(processed.isbn_10, 'L');
  }

  // Process description
  if (bookDetails?.description) {
    if (typeof bookDetails.description === 'string') {
      processed.description = bookDetails.description;
    } else if (typeof bookDetails.description === 'object' && bookDetails.description.value) {
      processed.description = bookDetails.description.value;
    }
  }

  return processed;
}

/**
 * Search and get detailed book information in one call
 */
export async function searchAndGetBookDetails(query: string, limit: number = 10): Promise<ProcessedBookData[]> {
  try {
    const searchResults = await searchBooks(query, limit);
    
    const detailedBooks = await Promise.all(
      searchResults.map(async (result) => {
        try {
          const details = await getBookDetails(result.key);
          return processBookData(result, details);
        } catch (error) {
          console.warn('Error getting book details for', result.title, error);
          // Return processed data with just search result info
          return processBookData(result);
        }
      })
    );

    return detailedBooks;
  } catch (error) {
    console.error('Error in searchAndGetBookDetails:', error);
    throw error;
  }
}

/**
 * Get book by ISBN with full details
 */
export async function getBookByISBN(isbn: string): Promise<ProcessedBookData | null> {
  try {
    const searchResults = await searchBooksByISBN(isbn);
    
    if (searchResults.length === 0) {
      return null;
    }

    const firstResult = searchResults[0];
    const details = await getBookDetails(firstResult.key);
    
    return processBookData(firstResult, details);
  } catch (error) {
    console.error('Error getting book by ISBN:', error);
    throw error;
  }
}
