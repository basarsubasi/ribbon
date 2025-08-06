-- For table strucure reference

CREATE TABLE books (
    book_id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_type TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT NOT NULL,
    publisher TEXT NOT NULL,
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
	price REAL
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



