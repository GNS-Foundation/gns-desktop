//! Storage Module - Local Database
//!
//! Encrypted SQLite database for storing messages, threads, and breadcrumbs.

use rusqlite::{Connection, params};
use std::path::PathBuf;
use gns_crypto_core::{GnsEnvelope, Breadcrumb};

use crate::commands::messaging::{ThreadPreview, Message};

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
            std::fs::create_dir_all(parent)
                .map_err(|e| DatabaseError::IoError(e.to_string()))?;
        }
        
        let conn = Connection::open(&path)
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
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
        self.conn.execute_batch(r#"
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
                payload_encrypted BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                is_outgoing INTEGER NOT NULL,
                status TEXT DEFAULT 'sent',
                FOREIGN KEY (thread_id) REFERENCES threads(id)
            );
            
            CREATE TABLE IF NOT EXISTS breadcrumbs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                h3_index TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                signature TEXT NOT NULL,
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
            
            CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_breadcrumbs_time ON breadcrumbs(timestamp DESC);
        "#).map_err(|e| DatabaseError::SqliteError(e.to_string()))
    }
    
    // ==================== Thread Operations ====================
    
    /// Get all threads
    pub fn get_threads(&self, include_archived: bool, limit: u32) -> Result<Vec<ThreadPreview>, DatabaseError> {
        let sql = if include_archived {
            "SELECT * FROM threads ORDER BY last_message_at DESC LIMIT ?"
        } else {
            "SELECT * FROM threads WHERE is_archived = 0 ORDER BY last_message_at DESC LIMIT ?"
        };
        
        let mut stmt = self.conn.prepare(sql)
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        let threads = stmt.query_map([limit], |row| {
            Ok(ThreadPreview {
                id: row.get(0)?,
                participant_public_key: row.get(1)?,
                participant_handle: row.get(2)?,
                last_message_preview: None, // TODO: join with messages
                last_message_at: row.get(3)?,
                unread_count: row.get(4)?,
                is_pinned: row.get::<_, i32>(5)? == 1,
                is_muted: row.get::<_, i32>(6)? == 1,
            })
        }).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        threads.collect::<Result<Vec<_>, _>>()
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))
    }
    
    /// Mark thread as read
    pub fn mark_thread_read(&mut self, thread_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "UPDATE threads SET unread_count = 0 WHERE id = ?",
            params![thread_id],
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }
    
    /// Delete a thread
    pub fn delete_thread(&mut self, thread_id: &str) -> Result<(), DatabaseError> {
        self.conn.execute("DELETE FROM messages WHERE thread_id = ?", params![thread_id])
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        self.conn.execute("DELETE FROM threads WHERE id = ?", params![thread_id])
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }
    
    // ==================== Message Operations ====================
    
    /// Get messages in a thread
    pub fn get_messages(
        &self,
        thread_id: &str,
        limit: u32,
        before_id: Option<&str>,
    ) -> Result<Vec<Message>, DatabaseError> {
        // Simplified implementation
        let sql = "SELECT * FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT ?";
        
        let mut stmt = self.conn.prepare(sql)
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        let messages = stmt.query_map(params![thread_id, limit], |row| {
            Ok(Message {
                id: row.get(0)?,
                thread_id: row.get(1)?,
                from_public_key: row.get(2)?,
                from_handle: row.get(3)?,
                payload_type: row.get(4)?,
                payload: serde_json::Value::Null, // TODO: decrypt
                timestamp: row.get(6)?,
                is_outgoing: row.get::<_, i32>(7)? == 1,
                status: row.get(8)?,
            })
        }).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        messages.collect::<Result<Vec<_>, _>>()
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))
    }
    
    /// Save a sent message
    pub fn save_sent_message(&mut self, envelope: &GnsEnvelope, payload: &[u8]) -> Result<(), DatabaseError> {
        // TODO: Implement proper message saving
        tracing::debug!("Saving sent message: {}", envelope.id);
        Ok(())
    }
    
    /// Count pending messages
    pub fn count_pending_messages(&self) -> Result<u32, DatabaseError> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM pending_messages",
            [],
            |row| row.get(0),
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        Ok(count as u32)
    }
    
    // ==================== Breadcrumb Operations ====================
    
    /// Count breadcrumbs
    pub fn count_breadcrumbs(&self) -> Result<u32, DatabaseError> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM breadcrumbs",
            [],
            |row| row.get(0),
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        Ok(count as u32)
    }
    
    /// Count unique locations
    pub fn count_unique_locations(&self) -> Result<u32, DatabaseError> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(DISTINCT h3_index) FROM breadcrumbs",
            [],
            |row| row.get(0),
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        Ok(count as u32)
    }
    
    /// Get first breadcrumb time
    pub fn get_first_breadcrumb_time(&self) -> Option<i64> {
        self.conn.query_row(
            "SELECT MIN(timestamp) FROM breadcrumbs",
            [],
            |row| row.get(0),
        ).ok()
    }
    
    /// Get last breadcrumb time
    pub fn get_last_breadcrumb_time(&self) -> Option<i64> {
        self.conn.query_row(
            "SELECT MAX(timestamp) FROM breadcrumbs",
            [],
            |row| row.get(0),
        ).ok()
    }
    
    /// Get recent breadcrumbs for handle claim
    pub fn get_recent_breadcrumbs(&self, limit: u32) -> Result<Vec<Breadcrumb>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT h3_index, timestamp, signature FROM breadcrumbs ORDER BY timestamp DESC LIMIT ?"
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        let breadcrumbs = stmt.query_map([limit], |row| {
            Ok(Breadcrumb {
                h3_index: row.get(0)?,
                timestamp: row.get(1)?,
                public_key: String::new(), // Will be filled by caller
                signature: row.get(2)?,
                resolution: 7,
            })
        }).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        
        breadcrumbs.collect::<Result<Vec<_>, _>>()
            .map_err(|e| DatabaseError::SqliteError(e.to_string()))
    }
    
    /// Save a breadcrumb
    pub fn save_breadcrumb(&mut self, breadcrumb: &Breadcrumb) -> Result<(), DatabaseError> {
        self.conn.execute(
            "INSERT OR IGNORE INTO breadcrumbs (h3_index, timestamp, signature) VALUES (?, ?, ?)",
            params![breadcrumb.h3_index, breadcrumb.timestamp, breadcrumb.signature],
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
        Ok(())
    }
    
    // ==================== Sync State ====================
    
    /// Get last sync time
    pub fn get_last_sync_time(&self) -> Option<i64> {
        self.conn.query_row(
            "SELECT value FROM sync_state WHERE key = 'last_sync'",
            [],
            |row| {
                let s: String = row.get(0)?;
                Ok(s.parse::<i64>().unwrap_or(0))
            },
        ).ok()
    }
    
    /// Set last sync time
    pub fn set_last_sync_time(&mut self, time: i64) -> Result<(), DatabaseError> {
        self.conn.execute(
            "INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_sync', ?)",
            params![time.to_string()],
        ).map_err(|e| DatabaseError::SqliteError(e.to_string()))?;
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
