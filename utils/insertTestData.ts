import * as SQLite from 'expo-sqlite';

export interface TestBook {
  book_type: string;
  title: string;
  cover_url?: string;
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

const testBooks: TestBook[] = [
  {
    book_type: 'paperback',
    title: 'The Great Gatsby',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780743273565-M.jpg',
    number_of_pages: 180,
    isbn: '9780743273565',
    year_published: 1925,
    current_page: 45,
    review: 'A masterpiece of American literature. Fitzgerald\'s prose is beautiful and the story is haunting.',
    notes: 'Great example of the American Dream theme',
    stars: 5,
    price: 12.99,
    authors: ['F. Scott Fitzgerald'],
    categories: ['Fiction', 'Classic Literature'],
    publishers: ['Scribner']
  },
  {
    book_type: 'hardcover',
    title: 'To Kill a Mockingbird',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780061120084-M.jpg',
    number_of_pages: 376,
    isbn: '9780061120084',
    year_published: 1960,
    current_page: 376,
    review: 'An important book that deals with serious themes through the eyes of a child.',
    notes: 'Finished reading - powerful ending',
    stars: 5,
    price: 15.99,
    authors: ['Harper Lee'],
    categories: ['Fiction', 'Classic Literature', 'Drama'],
    publishers: ['Harper Perennial Modern Classics']
  },
  {
    book_type: 'ebook',
    title: '1984',
    number_of_pages: 328,
    isbn: '9780451524935',
    year_published: 1949,
    current_page: 0,
    review: '',
    notes: 'Added to reading list',
    stars: 0,
    authors: ['George Orwell'],
    categories: ['Fiction', 'Dystopian', 'Science Fiction'],
    publishers: ['Signet Classics']
  },
  {
    book_type: 'paperback',
    title: 'The Catcher in the Rye',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780316769174-M.jpg',
    number_of_pages: 277,
    isbn: '9780316769174',
    year_published: 1951,
    current_page: 120,
    review: 'Holden\'s voice is unique and the story is engaging.',
    notes: 'Currently reading - interesting character development',
    stars: 4,
    price: 13.99,
    authors: ['J.D. Salinger'],
    categories: ['Fiction', 'Coming of Age'],
    publishers: ['Little, Brown and Company']
  },
  {
    book_type: 'hardcover',
    title: 'Pride and Prejudice',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780141439518-M.jpg',
    number_of_pages: 432,
    isbn: '9780141439518',
    year_published: 1813,
    current_page: 200,
    review: 'Austen\'s wit and social commentary are brilliant.',
    notes: 'Love the character of Elizabeth Bennet',
    stars: 4,
    price: 14.99,
    authors: ['Jane Austen'],
    categories: ['Fiction', 'Romance', 'Classic Literature'],
    publishers: ['Penguin Classics']
  },
  {
    book_type: 'pdf',
    title: 'The Art of War',
    number_of_pages: 96,
    isbn: '9781599869773',
    year_published: -500,
    current_page: 96,
    review: 'Timeless wisdom that applies to many areas of life.',
    notes: 'Completed - took detailed notes on strategy',
    stars: 4,
    authors: ['Sun Tzu'],
    categories: ['Philosophy', 'Strategy', 'Non-fiction'],
    publishers: ['Chiron Academic Press']
  },
  {
    book_type: 'paperback',
    title: 'Dune',
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg',
    number_of_pages: 688,
    isbn: '9780441172719',
    year_published: 1965,
    current_page: 350,
    review: 'Epic world-building and complex political intrigue.',
    notes: 'Halfway through - fascinating universe',
    stars: 5,
    price: 16.99,
    authors: ['Frank Herbert'],
    categories: ['Science Fiction', 'Fantasy', 'Adventure'],
    publishers: ['Ace Books']
  },
  {
    book_type: 'ebook',
    title: 'The Hobbit',
    number_of_pages: 310,
    isbn: '9780547928227',
    year_published: 1937,
    current_page: 0,
    authors: ['J.R.R. Tolkien'],
    categories: ['Fantasy', 'Adventure', 'Children\'s Literature'],
    publishers: ['Mariner Books']
  }
];

export const insertTestData = async (db: SQLite.SQLiteDatabase): Promise<void> => {
  try {
    console.log('Inserting test data...');

    // Insert each test book
    for (const book of testBooks) {
      await insertBook(db, book);
    }

    console.log('Test data inserted successfully!');
  } catch (error) {
    console.error('Error inserting test data:', error);
    throw error;
  }
};

const insertBook = async (db: SQLite.SQLiteDatabase, book: TestBook): Promise<void> => {
  try {
    // Insert or get authors
    const authorIds: number[] = [];
    for (const authorName of book.authors) {
      const authorId = await insertOrGetAuthor(db, authorName);
      authorIds.push(authorId);
    }

    // Insert or get categories
    const categoryIds: number[] = [];
    for (const categoryName of book.categories) {
      const categoryId = await insertOrGetCategory(db, categoryName);
      categoryIds.push(categoryId);
    }

    // Insert or get publishers
    const publisherIds: number[] = [];
    for (const publisherName of book.publishers) {
      const publisherId = await insertOrGetPublisher(db, publisherName);
      publisherIds.push(publisherId);
    }

    // Insert book (using INSERT OR IGNORE to avoid duplicates based on ISBN)
    const insertBookQuery = `
      INSERT OR IGNORE INTO books (
        book_type, title, cover_url, number_of_pages, isbn, year_published,
        current_page, review, notes, stars, price, date_added, last_read
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 
        CASE WHEN ? > 0 THEN datetime('now', '-' || abs(random() % 30) || ' days') ELSE NULL END)
    `;

    const result = await db.runAsync(insertBookQuery, [
      book.book_type,
      book.title,
      book.cover_url || null,
      book.number_of_pages,
      book.isbn || null,
      book.year_published || null,
      book.current_page,
      book.review || null,
      book.notes || null,
      book.stars || null,
      book.price || null,
      book.current_page // For the CASE WHEN clause
    ]);

    // Get the book ID (either newly inserted or existing)
    let bookId: number;
    if (result.changes > 0) {
      bookId = result.lastInsertRowId;
    } else {
      // Book already exists, get its ID
      const existingBook = await db.getFirstAsync<{ book_id: number }>(
        'SELECT book_id FROM books WHERE isbn = ? OR title = ?',
        [book.isbn || '', book.title]
      );
      if (!existingBook) {
        throw new Error(`Could not find or insert book: ${book.title}`);
      }
      bookId = existingBook.book_id;
    }

    // Insert book-author relationships
    for (const authorId of authorIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO book_authors (book_id, author_id) VALUES (?, ?)',
        [bookId, authorId]
      );
    }

    // Insert book-category relationships
    for (const categoryId of categoryIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)',
        [bookId, categoryId]
      );
    }

    // Insert book-publisher relationships
    for (const publisherId of publisherIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO book_publishers (book_id, publisher_id) VALUES (?, ?)',
        [bookId, publisherId]
      );
    }

    console.log(`Inserted book: ${book.title}`);
  } catch (error) {
    console.error(`Error inserting book ${book.title}:`, error);
    throw error;
  }
};

const insertOrGetAuthor = async (db: SQLite.SQLiteDatabase, name: string): Promise<number> => {
  // Try to insert, ignore if exists
  const insertResult = await db.runAsync(
    'INSERT OR IGNORE INTO authors (name) VALUES (?)',
    [name]
  );

  if (insertResult.changes > 0) {
    return insertResult.lastInsertRowId;
  } else {
    // Author already exists, get its ID
    const existingAuthor = await db.getFirstAsync<{ author_id: number }>(
      'SELECT author_id FROM authors WHERE name = ?',
      [name]
    );
    if (!existingAuthor) {
      throw new Error(`Could not find or insert author: ${name}`);
    }
    return existingAuthor.author_id;
  }
};

const insertOrGetCategory = async (db: SQLite.SQLiteDatabase, name: string): Promise<number> => {
  // Try to insert, ignore if exists
  const insertResult = await db.runAsync(
    'INSERT OR IGNORE INTO categories (name) VALUES (?)',
    [name]
  );

  if (insertResult.changes > 0) {
    return insertResult.lastInsertRowId;
  } else {
    // Category already exists, get its ID
    const existingCategory = await db.getFirstAsync<{ category_id: number }>(
      'SELECT category_id FROM categories WHERE name = ?',
      [name]
    );
    if (!existingCategory) {
      throw new Error(`Could not find or insert category: ${name}`);
    }
    return existingCategory.category_id;
  }
};

const insertOrGetPublisher = async (db: SQLite.SQLiteDatabase, name: string): Promise<number> => {
  // Try to insert, ignore if exists
  const insertResult = await db.runAsync(
    'INSERT OR IGNORE INTO publishers (name) VALUES (?)',
    [name]
  );

  if (insertResult.changes > 0) {
    return insertResult.lastInsertRowId;
  } else {
    // Publisher already exists, get its ID
    const existingPublisher = await db.getFirstAsync<{ publisher_id: number }>(
      'SELECT publisher_id FROM publishers WHERE name = ?',
      [name]
    );
    if (!existingPublisher) {
      throw new Error(`Could not find or insert publisher: ${name}`);
    }
    return existingPublisher.publisher_id;
  }
};
