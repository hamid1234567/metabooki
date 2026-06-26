create index if not exists books_publisher_created_at_idx
on public.books (publisher_id, created_at desc);

create index if not exists user_books_book_id_idx
on public.user_books (book_id);
