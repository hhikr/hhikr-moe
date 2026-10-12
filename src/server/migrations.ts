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
  {
    id: '004_stats',
    sql: `
      -- Page views, counted per day (Asia/Shanghai) and address. No row here
      -- or below can be traced back to a visitor.
      CREATE TABLE stats_daily (
        day TEXT NOT NULL,
        path TEXT NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        visitors INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, path)
      );
      CREATE INDEX stats_daily_path ON stats_daily(path);

      -- Whole-site totals; visitors are distinct across all pages of the day.
      CREATE TABLE stats_days (
        day TEXT PRIMARY KEY,
        views INTEGER NOT NULL DEFAULT 0,
        visitors INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE stats_referrers (
        day TEXT NOT NULL,
        host TEXT NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, host)
      );

      CREATE TABLE stats_agents (
        day TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('browser','device')),
        name TEXT NOT NULL,
        views INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, kind, name)
      );

      -- Who has been counted today, as keyed hashes that change every day.
      -- Emptied when the day changes. The path '' stands for the whole site.
      CREATE TABLE stats_seen (
        day TEXT NOT NULL,
        path TEXT NOT NULL,
        visitor_hash TEXT NOT NULL,
        PRIMARY KEY (day, path, visitor_hash)
      ) WITHOUT ROWID;
    `,
  },
  {
    id: '005_backup',
    sql: `
      CREATE TABLE backup_runs (
        id INTEGER PRIMARY KEY,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        ok INTEGER,
        -- Whether this run found anything new to commit.
        committed INTEGER NOT NULL DEFAULT 0,
        uploaded INTEGER NOT NULL DEFAULT 0,
        repo_bytes INTEGER,
        warnings_json TEXT NOT NULL DEFAULT '[]',
        error TEXT
      );

      -- Files kept as release attachments instead of in git, by their place
      -- in the data directory. The attachment is named after the SHA-256.
      CREATE TABLE backup_blobs (
        path TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL,
        size INTEGER NOT NULL,
        release_tag TEXT NOT NULL,
        asset_id INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL
      );
    `,
  },
  {
    id: '006_projects',
    sql: `
      -- Things the author made and offers for download: project, versions, files.
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK (kind IN ('mod','app','other')) DEFAULT 'mod',
        title TEXT NOT NULL,
        summary TEXT,
        description_md TEXT NOT NULL DEFAULT '',
        description_html TEXT NOT NULL DEFAULT '',
        cover_media_id INTEGER REFERENCES media(id),
        -- JSON arrays: gallery images as media ids, links as {label, url}.
        images_json TEXT NOT NULL DEFAULT '[]',
        links_json TEXT NOT NULL DEFAULT '[]',
        -- A post about this work, linked from its page.
        post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
        hidden INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE releases (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        notes_md TEXT NOT NULL DEFAULT '',
        notes_html TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (project_id, version)
      );

      -- The bytes live at files/<first two hex chars>/<sha256>.
      CREATE TABLE assets (
        id INTEGER PRIMARY KEY,
        release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        note TEXT,
        sha256 TEXT NOT NULL,
        size INTEGER NOT NULL,
        downloads INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE (release_id, filename)
      );
      CREATE INDEX assets_sha ON assets(sha256);
    `,
  },
  {
    id: '007_cosmo',
    sql: `
      -- One-time codes that hand the endministrator over to Cosmo.
      CREATE TABLE cosmo_codes (
        code_hash TEXT PRIMARY KEY,
        session_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );

      -- What the Cosmo gate holds after redeeming a code. It ends with the
      -- site session it came from.
      CREATE TABLE cosmo_grants (
        grant_hash TEXT PRIMARY KEY,
        session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
      CREATE INDEX cosmo_grants_session ON cosmo_grants(session_hash);
    `,
  },
];
