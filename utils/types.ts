import { ProcessedBookData } from './openLibraryUtils';

// types for reference

export type Book = {
  book_id: number;
  book_type: string;
  title: string;
  cover_url?: string;
  cover_path?: string;
  number_of_pages: number;
  isbn_13?: string;
  openlibrary_code?: string;
  year_written?: number;
  year_published?: number;
  date_added: string;
  last_read?: string;
  current_page: number;
  review?: string;
  notes?: string;
  stars?: number;
  price?: number;
};

export type Category = {
  category_id: number;
  category_name: string;
};

export type BookCategory = {
  book_id: number;
  category_id: number;
};

export type Author = {
  author_id: number;
  author_name: string;
};

export type BookAuthor = {
  book_id: number;
  author_id: number;
};

export type Publisher = {
  publisher_id: number;
  publisher_name: string;
};

export type BookPublisher = {
  book_id: number;
  publisher_id: number;
};

export type PageLog = {
  page_log_id: number;
  book_id: number;
  start_page: number;
  end_page: number;
  current_page_after_log: number;
  read_date: string;
  read_time: string;
};

export type LibraryStackParamList = {
  Library: undefined;
  AddBook: { 
    bookData?: ProcessedBookData; 
    isbn?: string; 
  } | undefined;
  LibraryBookDetails: {
    bookId: number;
  };
  OpenLibraryBookDetails: { 
    bookId?: number;
    bookData?: ProcessedBookData;
  };
  EditBook: { bookId: number };
  ScanBarcode: undefined;
  SearchBook: undefined;
};

export type PageLogsStackParamList = {
  Calendar: undefined;
  LogPages: { bookId: number };
  LogDetails: { logId: number };
  EditLog: { logId: number };
  ChooseBook: undefined
};

