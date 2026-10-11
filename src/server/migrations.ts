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
  {
    id: '002_accounts',
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('user','endmin')) DEFAULT 'user',
        nickname TEXT NOT NULL COLLATE NOCASE,
        discriminator TEXT NOT NULL,
        password_hash TEXT,
        google_sub TEXT UNIQUE,
        avatar_sha256 TEXT,
        status TEXT NOT NULL CHECK (status IN ('active','banned')) DEFAULT 'active',
        created_at TEXT NOT NULL,
        UNIQUE (nickname, discriminator)
      );

      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);

      CREATE TABLE rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start INTEGER NOT NULL
      );

      -- Proof-of-work challenges that have been spent, kept until they expire.
      CREATE TABLE used_challenges (
        salt TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );

      -- One-time sign-in links created from the server's command line.
      CREATE TABLE login_links (
        token_hash TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );
    `,
  },
  {
    id: '003_comments',
    sql: `
      CREATE TABLE comments (
        id INTEGER PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        -- Replies hang off a top-level comment; there is one level only.
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        html TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('visible','hidden','deleted')) DEFAULT 'visible',
        created_at TEXT NOT NULL
      );
      CREATE INDEX comments_post ON comments(post_id, created_at);
      CREATE INDEX comments_user ON comments(user_id);
    `,
  },
];
