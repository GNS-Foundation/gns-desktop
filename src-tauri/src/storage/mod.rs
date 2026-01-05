//! Storage Module - Local Database
//!
//! SQLite database for storing messages, threads, and breadcrumbs.

use gns_crypto_core::{Breadcrumb, GnsEnvelope};
use rusqlite::{params, Connection};
use std::path::PathBuf;

use crate::commands::messaging::{Message, ThreadPreview, Reaction};

/// Local database
pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open or create the database
    pub fn open() -> Result<Self, DatabaseError> {
        let path = Self::database_path()?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| DatabaseError::IoError(e.to_string()))?;
        }

        let conn =
            Connection::open(&path).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        let db = Self { conn };
        db.initialize_tables()?;

        Ok(db)
    }

    /// Get the database file path
    fn database_path() -> Result<PathBuf, DatabaseError> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| DatabaseError::IoError("Could not find data directory".to_string()))?;

        Ok(data_dir.join("gns-browser").join("gns.db"))
    }

    /// Initialize database tables
    fn initialize_tables(&self) -> Result<(), DatabaseError> {
        self.conn
            .execute_batch(
                r#"
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                participant_public_key TEXT NOT NULL,
                participant_handle TEXT,
                last_message_at INTEGER NOT NULL,
                unread_count INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                is_muted INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                from_public_key TEXT NOT NULL,
                from_handle TEXT,
                payload_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_outgoing INTEGER NOT NULL,
                status TEXT DEFAULT 'sent',
                signature_valid INTEGER DEFAULT 1,
                reply_to_id TEXT,
                is_starred INTEGER DEFAULT 0,
                forwarded_from_id TEXT,
                FOREIGN KEY (thread_id) REFERENCES threads(id)
            );
            
            CREATE TABLE IF NOT EXISTS breadcrumbs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                h3_index TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                signature TEXT NOT NULL,
                prev_hash TEXT,
                UNIQUE(h3_index, timestamp)
            );
            
            CREATE TABLE IF NOT EXISTS pending_messages (
                id TEXT PRIMARY KEY,
                envelope_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                retry_count INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS sync_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS reactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL,
                from_public_key TEXT NOT NULL,
                emoji TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_breadcrumbs_time ON breadcrumbs(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
        "#,
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        // Migrations
        let _ = self.conn.execute("ALTER TABLE messages ADD COLUMN reply_to_id TEXT", []);
        let _ = self.conn.execute("ALTER TABLE messages ADD COLUMN is_starred INTEGER DEFAULT 0", []);
        let _ = self.conn.execute("ALTER TABLE messages ADD COLUMN forwarded_from_id TEXT", []);

        Ok(())
    }

    // ==================== Thread Operations ====================

    /// Get or create thread for a conversation
    pub fn get_or_create_thread(
        &mut self,
        thread_id: &str,
        participant_public_key: &str,
        participant_handle: Option<&str>,
    ) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                r#"
                INSERT INTO threads (id, participant_public_key, participant_handle, last_message_at, unread_count)
                VALUES (?, ?, ?, ?, 0)
                ON CONFLICT(id) DO UPDATE SET
                    participant_handle = COALESCE(excluded.participant_handle, threads.participant_handle)
                "#,
                params![
                    thread_id,
                    participant_public_key,
                    participant_handle,
                    chrono::Utc::now().timestamp_millis()
                ],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    /// Update thread with new message
    fn update_thread_for_message(
        &mut self,
        thread_id: &str,
        timestamp: i64,
        is_incoming: bool,
    ) -> Result<(), DatabaseError> {
        if is_incoming {
            // Increment unread count for incoming messages
            self.conn
                .execute(
                    "UPDATE threads SET last_message_at = ?, unread_count = unread_count + 1 WHERE id = ?",
                    params![timestamp, thread_id],
                )
                .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        } else {
            self.conn
                .execute(
                    "UPDATE threads SET last_message_at = ? WHERE id = ?",
                    params![timestamp, thread_id],
                )
                .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        }
        Ok(())
    }

    /// Get all threads
    pub fn get_threads(
        &self,
        include_archived: bool,
        limit: u32,
    ) -> Result<Vec<ThreadPreview>, DatabaseError> {
        let sql = if include_archived {
            r#"
            SELECT t.*, 
                   (SELECT payload_json FROM messages m WHERE m.thread_id = t.id ORDER BY timestamp DESC LIMIT 1) as last_payload
            FROM threads t 
            ORDER BY last_message_at DESC LIMIT ?
            "#
        } else {
            r#"
            SELECT t.*, 
                   (SELECT payload_json FROM messages m WHERE m.thread_id = t.id ORDER BY timestamp DESC LIMIT 1) as last_payload
            FROM threads t 
            WHERE is_archived = 0 
            ORDER BY last_message_at DESC LIMIT ?
            "#
        };

        let mut stmt = self
            .conn
            .prepare(sql)
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        let threads = stmt
            .query_map([limit], |row| {
                let last_payload: Option<String> = row.get(8).ok();
                let preview = last_payload.and_then(|p| {
                    serde_json::from_str::<serde_json::Value>(&p)
                        .ok()
                        .and_then(|v| v["text"].as_str().map(|s| s.to_string()))
                });

                Ok(ThreadPreview {
                    id: row.get(0)?,
                    participant_public_key: row.get(1)?,
                    participant_handle: row.get(2)?,
                    last_message_preview: preview,
                    last_message_at: row.get(3)?,
                    unread_count: row.get(4)?,
                    is_pinned: row.get::<_, i32>(5)? == 1,
                    is_muted: row.get::<_, i32>(6)? == 1,
                })
            })
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        threads
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))
    }

    /// Get a single thread by ID
    pub fn get_thread(&self, thread_id: &str) -> Result<Option<ThreadPreview>, DatabaseError> {
        let sql = r#"
            SELECT t.*, 
                   (SELECT payload_json FROM messages m WHERE m.thread_id = t.id ORDER BY timestamp DESC LIMIT 1) as last_payload
            FROM threads t 
            WHERE id = ?
        "#;

        let mut stmt = self
            .conn
            .prepare(sql)
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        let mut rows = stmt
            .query_map([thread_id], |row| {
                let last_payload: Option<String> = row.get(8).ok();
                let preview = last_payload.and_then(|p| {
                    serde_json::from_str::<serde_json::Value>(&p)
                        .ok()
                        .and_then(|v| v["text"].as_str().map(|s| s.to_string()))
                });

                Ok(ThreadPreview {
                    id: row.get(0)?,
                    participant_public_key: row.get(1)?,
                    participant_handle: row.get(2)?,
                    last_message_preview: preview,
                    last_message_at: row.get(3)?,
                    unread_count: row.get(4)?,
                    is_pinned: row.get::<_, i32>(5)? == 1,
                    is_muted: row.get::<_, i32>(6)? == 1,
                })
            })
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        if let Some(row) = rows.next() {
            row.map(Some).map_err(|e| DatabaseError::SqliteError(e.to_string()))
        } else {
            Ok(None)
        }
    }

    /// Mark thread as read
    pub fn mark_thread_read(&mut self, thread_id: &str) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                "UPDATE threads SET unread_count = 0 WHERE id = ?",
                params![thread_id],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    /// Delete a thread
    pub fn delete_thread(&mut self, thread_id: &str) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                "DELETE FROM messages WHERE thread_id = ?",
                params![thread_id],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        self.conn
            .execute("DELETE FROM threads WHERE id = ?", params![thread_id])
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    /// Delete a message
    pub fn delete_message(&mut self, message_id: &str) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                "DELETE FROM messages WHERE id = ?",
                params![message_id],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    // ==================== Message Operations ====================

    /// Get messages in a thread
    pub fn get_messages(
        &self,
        thread_id: &str,
        limit: u32,
    ) -> Result<Vec<Message>, DatabaseError> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, thread_id, from_public_key, from_handle, payload_type, payload_json, timestamp, is_outgoing, status, reply_to_id, is_starred, forwarded_from_id FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT ?",
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        let mut messages = stmt
            .query_map(params![thread_id, limit], |row| {
                let payload_str: String = row.get(5)?;
                let payload_json: serde_json::Value =
                    serde_json::from_str(&payload_str).unwrap_or_default();
                
                Ok(Message {
                    id: row.get(0)?,
                    thread_id: row.get(1)?,
                    from_public_key: row.get(2)?,
                    from_handle: row.get(3)?,
                    payload_type: row.get(4)?,
                    payload: payload_json,
                    timestamp: row.get(6)?,
                    is_outgoing: row.get(7)?,
                    status: row.get(8)?,
                    reply_to_id: row.get(9)?,
                    is_starred: row.get(10).unwrap_or(false),
                    forwarded_from_id: row.get(11)?,
                    reactions: Vec::new(),
                })
            })
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        // Fetch reactions for each message
        for message in &mut messages {
            let mut r_stmt = self
                .conn
                .prepare("SELECT emoji, from_public_key FROM reactions WHERE message_id = ?")
                .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

            let reactions = r_stmt
                .query_map(params![message.id], |row| {
                    Ok(Reaction {
                        emoji: row.get(0)?,
                        from_public_key: row.get(1)?,
                    })
                })
                .map_err(|e| DatabaseError::SqliteError(e.to_string()))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

            message.reactions = reactions;
        }

        Ok(messages)
    }
    /// Save a sent message
    pub fn save_sent_message(
        &mut self,
        envelope: &GnsEnvelope,
        payload: &[u8],
        _recipient_handle: Option<&str>,
        reply_to_id: Option<String>,
    ) -> Result<(), DatabaseError> {
        tracing::debug!("Saving sent message: {}", envelope.id);

        // Parse payload as JSON
        let payload_json: serde_json::Value = serde_json::from_slice(payload)
            .unwrap_or_else(|_| serde_json::json!({"text": String::from_utf8_lossy(payload).to_string()}));

        // Determine thread ID
        let thread_id = envelope.thread_id.clone().unwrap_or_else(|| {
            // Match message_handler.rs logic: direct_{sorted_keys}
            let my_pk = &envelope.from_public_key;
            let other_pk = &envelope.to_public_keys[0];
            let mut keys = vec![my_pk.as_str(), other_pk.as_str()];
            keys.sort();
            format!("direct_{}", &keys.join("_")[..32])
        });

        // Get or create thread
        let recipient_pk = &envelope.to_public_keys[0];
        self.get_or_create_thread(&thread_id, recipient_pk, _recipient_handle)?;

        // Insert message
        self.conn
            .execute(
                r#"
                INSERT OR REPLACE INTO messages 
                (id, thread_id, from_public_key, from_handle, payload_type, payload_json, timestamp, is_outgoing, status, signature_valid, reply_to_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'sent', 1, ?)
                "#,
                params![
                    envelope.id,
                    thread_id,
                    envelope.from_public_key,
                    envelope.from_handle,
                    envelope.payload_type,
                    serde_json::to_string(&payload_json).unwrap_or_default(),
                    envelope.timestamp,
                    reply_to_id,
                ],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        // Update thread
        self.update_thread_for_message(&thread_id, envelope.timestamp, false)?;

        Ok(())
    }

    /// Save a received message
    pub fn save_received_message(
        &mut self,
        message_id: &str,
        thread_id: &str,
        from_public_key: &str,
        from_handle: Option<&str>,
        payload_type: &str,
        payload: &serde_json::Value,
        timestamp: i64,
        signature_valid: bool,
        reply_to_id: Option<String>,
    ) -> Result<(), DatabaseError> {
        tracing::debug!("Saving received message: {}", message_id);

        // Get or create thread
        self.get_or_create_thread(thread_id, from_public_key, from_handle)?;

        // Insert message
        self.conn
            .execute(
                r#"
                INSERT OR REPLACE INTO messages 
                (id, thread_id, from_public_key, from_handle, payload_type, payload_json, timestamp, is_outgoing, status, signature_valid, reply_to_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'received', ?, ?)
                "#,
                params![
                    message_id,
                    thread_id,
                    from_public_key,
                    from_handle,
                    payload_type,
                    serde_json::to_string(payload).unwrap_or_default(),
                    timestamp,
                    if signature_valid { 1 } else { 0 },
                    reply_to_id,
                ],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        // Update thread with incremented unread
        self.update_thread_for_message(thread_id, timestamp, true)?;

        Ok(())
    }

    /// Save a reaction
    pub fn save_reaction(
        &mut self,
        message_id: &str,
        from_public_key: &str,
        emoji: &str,
        timestamp: i64,
    ) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                "INSERT INTO reactions (message_id, from_public_key, emoji, timestamp) VALUES (?, ?, ?, ?)",
                params![message_id, from_public_key, emoji, timestamp],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    /// Count pending messages
    pub fn count_pending_messages(&self) -> Result<u32, DatabaseError> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM pending_messages", [], |row| {
                row.get(0)
            })
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        Ok(count as u32)
    }

    // ==================== Breadcrumb Operations ====================

    /// Count breadcrumbs
    pub fn count_breadcrumbs(&self) -> Result<u32, DatabaseError> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM breadcrumbs", [], |row| row.get(0))
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        Ok(count as u32)
    }

    /// Count unique locations
    pub fn count_unique_locations(&self) -> Result<u32, DatabaseError> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(DISTINCT h3_index) FROM breadcrumbs",
                [],
                |row| row.get(0),
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        Ok(count as u32)
    }

    /// Get first breadcrumb time
    pub fn get_first_breadcrumb_time(&self) -> Option<i64> {
        self.conn
            .query_row("SELECT MIN(timestamp) FROM breadcrumbs", [], |row| {
                row.get(0)
            })
            .ok()
    }

    /// Get last breadcrumb time
    pub fn get_last_breadcrumb_time(&self) -> Option<i64> {
        self.conn
            .query_row("SELECT MAX(timestamp) FROM breadcrumbs", [], |row| {
                row.get(0)
            })
            .ok()
    }

    /// Get recent breadcrumbs for handle claim
    pub fn get_recent_breadcrumbs(&self, limit: u32) -> Result<Vec<Breadcrumb>, DatabaseError> {
        self.get_breadcrumbs(limit, 0)
    }

    /// Get breadcrumbs with pagination
    pub fn get_breadcrumbs(&self, limit: u32, offset: u32) -> Result<Vec<Breadcrumb>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT h3_index, timestamp, signature, prev_hash FROM breadcrumbs ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        let breadcrumbs = stmt
            .query_map([limit, offset], |row| {
                Ok(Breadcrumb {
                    h3_index: row.get(0)?,
                    timestamp: row.get(1)?,
                    public_key: String::new(),
                    signature: row.get(2)?,
                    resolution: 7,
                    prev_hash: row.get(3)?,
                })
            })
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;

        breadcrumbs
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))
    }

    /// Save a breadcrumb
    pub fn save_breadcrumb(&mut self, breadcrumb: &Breadcrumb) -> Result<(), DatabaseError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO breadcrumbs (h3_index, timestamp, signature, prev_hash) VALUES (?, ?, ?, ?)",
            params![breadcrumb.h3_index, breadcrumb.timestamp, breadcrumb.signature, breadcrumb.prev_hash],
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    // ==================== Sync State ====================

    /// Get last sync time
    pub fn get_last_sync_time(&self) -> Option<i64> {
        self.conn
            .query_row(
                "SELECT value FROM sync_state WHERE key = 'last_sync'",
                [],
                |row| {
                    let s: String = row.get(0)?;
                    Ok(s.parse::<i64>().unwrap_or(0))
                },
            )
            .ok()
    }

    /// Set last sync time
    pub fn set_last_sync_time(&mut self, time: i64) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_sync', ?)",
                params![time.to_string()],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }

    /// Clear all data from database
    pub fn clear_all(&mut self) -> Result<(), DatabaseError> {
        tracing::info!("🗑️ Clearing all database data...");
        
        self.conn.execute("DELETE FROM messages", [])
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        self.conn.execute("DELETE FROM threads", [])
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        let _ = self.conn.execute("DELETE FROM breadcrumbs", []);
        self.conn.execute("VACUUM", [])
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        tracing::info!("✅ Database cleared");
        Ok(())
    }

    // ==================== Collection State ====================

    /// Get collection enabled state
    pub fn get_collection_enabled(&self) -> bool {
        self.conn
            .query_row(
                "SELECT value FROM sync_state WHERE key = 'collection_enabled'",
                [],
                |row| {
                    let s: String = row.get(0)?;
                    Ok(s == "true")
                },
            )
            .unwrap_or(false)
    }

    /// Set collection enabled state
    pub fn set_collection_enabled(&mut self, enabled: bool) -> Result<(), DatabaseError> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('collection_enabled', ?)",
                params![if enabled { "true" } else { "false" }],
            )
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }
}

/// Database errors
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("SQLite error: {0}")]
    SqliteError(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Encryption error: {0}")]
    EncryptionError(String),
}
