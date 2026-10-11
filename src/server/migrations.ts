// Schema changes, applied in order at startup. Never edit an entry that has
// shipped; append a new one instead.
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_posts_and_media',
    sql: `
      CREATE TABLE media (
        id INTEGER PRIMARY KEY,
        sha256 TEXT NOT NULL UNIQUE,
        ext TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT,
        category TEXT,
        series TEXT,
        series_order REAL,
        cover_media_id INTEGER REFERENCES media(id),
        status TEXT NOT NULL CHECK (status IN ('draft','published')) DEFAULT 'draft',
        hidden INTEGER NOT NULL DEFAULT 0,
        pinned INTEGER NOT NULL DEFAULT 0,
        comments_enabled INTEGER NOT NULL DEFAULT 1,
        source_md TEXT NOT NULL,
        html TEXT NOT NULL,
        headings_json TEXT NOT NULL,
        words INTEGER NOT NULL,
        minutes INTEGER NOT NULL,
        published_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX posts_listing ON posts(status, hidden, published_at);

      CREATE TABLE post_tags (
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (post_id, tag)
      );

      CREATE TABLE post_working_copies (
        id INTEGER PRIMARY KEY,
        post_id INTEGER UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
        fields_json TEXT NOT NULL,
        source_md TEXT NOT NULL,
        saved_at TEXT NOT NULL
      );

      CREATE TABLE post_revisions (
        id INTEGER PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        fields_json TEXT NOT NULL,
        source_md TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE post_redirects (
        old_slug TEXT PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];
