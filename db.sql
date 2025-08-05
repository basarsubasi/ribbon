-- For table strucure reference

CREATE TABLE books (
    book_id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_type TEXT NOT NULL,
    title TEXT NOT NULL,
	cover_url TEXT,
	cover_path TEXT,
    number_of_pages INTEGER NOT NULL,
    isbn_13 TEXT UNIQUE,
    openlibrary_code TEXT UNIQUE, 
    year_written INTEGER,
    year_published INTEGER,
    date_added DATE DEFAULT CURRENT_DATE, 
    last_read  TIMESTAMP,
    current_page INTEGER NOT NULL DEFAULT 0,
    review TEXT,
	notes TEXT,
	stars INTEGER, 
	price REAL,
	
);

CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL UNIQUE
);



CREATE TABLE book_categories (
    book_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, category_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE
);



CREATE TABLE authors (
    author_id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name TEXT NOT NULL UNIQUE
);

CREATE TABLE book_authors (
    book_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, author_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE
);


CREATE TABLE publishers (
    publisher_id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_name TEXT NOT NULL UNIQUE
);


CREATE TABLE book_publishers (
    book_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, publisher_id),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) ON DELETE CASCADE
);

CREATE TABLE page_logs (
    page_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    start_page INTEGER NOT NULL,
    end_page INTEGER NOT NULL,
    current_page_after_log INTEGER NOT NULL,
    total_page_read INTEGER NOT NULL,
    read_date DATE DEFAULT CURRENT_DATE,
    read_time TEXT DEFAULT (STRFTIME('%H:%M', CURRENT_TIMESTAMP)),
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

CREATE TRIGGER update_book_last_read
AFTER INSERT ON page_logs
FOR EACH ROW
BEGIN
    UPDATE books
    SET last_read = CURRENT_TIMESTAMP
    WHERE book_id = NEW.book_id;
END;



