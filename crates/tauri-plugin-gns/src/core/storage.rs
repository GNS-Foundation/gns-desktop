//! Storage Manager
//!
//! SQLite storage for identities, messages, and breadcrumbs.
//!
//! # Encryption Model
//!
//! **Current implementation**: The `encrypt` parameter is a placeholder for future
//! SQLCipher integration. Currently:
//! - Secret keys are stored encrypted in the database (encrypted by application layer)
//! - The database file itself is NOT encrypted (SQLCipher integration planned)
//!
//! **Planned for v1.0**:
//! - Integrate SQLCipher for at-rest encryption
//! - Use platform keychain to store the database encryption key
//!
//! # Security Notes
//!
//! - All SQL queries use parameterized statements to prevent injection
//! - Secret keys are encrypted before storage using application-layer encryption
//! - The database uses foreign key constraints for referential integrity

use crate::error::{Error, Result};
use crate::models::*;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;

/// Storage manager for GNS data
///
/// # Encryption Status
///
/// The `encrypted` field indicates whether SQLCipher encryption is enabled.
/// **Note**: This is currently a placeholder - SQLCipher integration is planned for v1.0.
/// Secret keys are encrypted at the application layer regardless of this flag.
pub struct StorageManager {
    conn: Mutex<Connection>,
    /// Whether database-level encryption is enabled (SQLCipher)
    /// 
    /// **Note**: Currently not implemented - this is a placeholder for v1.0.
    /// The application layer handles secret key encryption regardless.
    #[allow(dead_code)] // Planned for SQLCipher integration
    encrypted: bool,
}

impl StorageManager {
    /// Create a new storage manager
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the SQLite database file
    /// * `encrypt` - Whether to enable database encryption (placeholder for SQLCipher)
    ///
    /// # Note
    ///
    /// The `encrypt` parameter is currently a placeholder. SQLCipher integration
    /// is planned for v1.0. Secret keys are encrypted at the application layer
    /// regardless of this setting.
    pub fn new(path: &Path, encrypt: bool) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| Error::Storage(format!("Failed to create directory: {}", e)))?;
        }
        
        let conn = Connection::open(path)?;
        
        // Enable foreign keys
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        
        // TODO: Enable SQLCipher encryption when encrypt=true
        // This will be implemented in v1.0
        if encrypt {
            log::warn!(
                "Database encryption requested but SQLCipher not yet integrated. \
                 Secret keys are still encrypted at application layer."
            );
        }
        
        let storage = Self {
            conn: Mutex::new(conn),
            encrypted: encrypt,
        };
        
        storage.init_schema()?;
        
        Ok(storage)
    }

    /// Check if database encryption is enabled
    pub fn is_encrypted(&self) -> bool {
        self.encrypted
    }

    /// Initialize database schema
    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.execute_batch(
            r#"
            -- Identities table
            CREATE TABLE IF NOT EXISTS identities (
                public_key TEXT PRIMARY KEY,
                secret_key_encrypted TEXT NOT NULL,
                encryption_secret TEXT NOT NULL,
                encryption_public TEXT NOT NULL,
                name TEXT NOT NULL,
                handle TEXT,
                created_at TEXT NOT NULL,
                is_default INTEGER DEFAULT 0,
                trust_score REAL DEFAULT 0,
                breadcrumb_count INTEGER DEFAULT 0
            );

            -- Messages table
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                from_pk TEXT NOT NULL,
                to_pk TEXT NOT NULL,
                payload TEXT NOT NULL,
                ephemeral_key TEXT,
                signature TEXT NOT NULL,
                created_at TEXT NOT NULL,
                received_at TEXT,
                is_read INTEGER DEFAULT 0,
                decrypted_cache TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_pk);
            CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_pk);
            CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

            -- Breadcrumbs table
            CREATE TABLE IF NOT EXISTS breadcrumbs (
                id TEXT PRIMARY KEY,
                identity_pk TEXT NOT NULL,
                h3_index TEXT NOT NULL,
                h3_resolution INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                prev_hash TEXT,
                hash TEXT NOT NULL,
                signature TEXT NOT NULL,
                source TEXT NOT NULL,
                accuracy REAL,
                published INTEGER DEFAULT 0,
                FOREIGN KEY (identity_pk) REFERENCES identities(public_key)
            );
            CREATE INDEX IF NOT EXISTS idx_breadcrumbs_identity ON breadcrumbs(identity_pk);
            CREATE INDEX IF NOT EXISTS idx_breadcrumbs_timestamp ON breadcrumbs(timestamp);

            -- Epochs table
            CREATE TABLE IF NOT EXISTS epochs (
                epoch_hash TEXT PRIMARY KEY,
                identity_pk TEXT NOT NULL,
                epoch_index INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                merkle_root TEXT NOT NULL,
                block_count INTEGER NOT NULL,
                prev_epoch_hash TEXT,
                signature TEXT NOT NULL,
                FOREIGN KEY (identity_pk) REFERENCES identities(public_key)
            );

            -- Handle cache
            CREATE TABLE IF NOT EXISTS handle_cache (
                handle TEXT PRIMARY KEY,
                public_key TEXT NOT NULL,
                encryption_key TEXT,
                trust_score REAL,
                breadcrumb_count INTEGER,
                cached_at TEXT NOT NULL
            );

            -- Contacts
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                owner_pk TEXT NOT NULL,
                contact_pk TEXT NOT NULL,
                name TEXT,
                handle TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                UNIQUE(owner_pk, contact_pk),
                FOREIGN KEY (owner_pk) REFERENCES identities(public_key)
            );
            "#,
        )?;
        
        Ok(())
    }

    // ==================== Identity Operations ====================

    /// Save an identity to storage
    pub fn save_identity(
        &self,
        public_key: &str,
        secret_key_encrypted: &str,
        encryption_secret: &str,
        encryption_public: &str,
        name: &str,
    ) -> Result<()> {
        log::info!("💾 STORAGE: Saving identity '{}' (pk: {}...)", name, &public_key[..8]);
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let rows = conn.execute(
            r#"
            INSERT OR REPLACE INTO identities 
            (public_key, secret_key_encrypted, encryption_secret, encryption_public, name, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
            "#,
            params![public_key, secret_key_encrypted, encryption_secret, encryption_public, name],
        )?;
        
        log::info!("✅ STORAGE: Identity saved successfully. Rows affected: {}", rows);
        Ok(())
    }

    /// Get an identity by public key
    pub fn get_identity(&self, public_key: &str) -> Result<Option<Identity>> {
        log::info!("🔍 STORAGE: Querying identity (pk: {}...)", &public_key[..8]);
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let result = conn.query_row(
            r#"
            SELECT public_key, name, handle, encryption_public, created_at, 
                   is_default, trust_score, breadcrumb_count
            FROM identities WHERE public_key = ?1
            "#,
            params![public_key],
            |row| {
                Ok(Identity {
                    public_key: row.get(0)?,
                    name: row.get(1)?,
                    handle: row.get(2)?,
                    encryption_key: row.get(3)?,
                    created_at: row.get(4)?,
                    is_default: row.get::<_, i32>(5)? == 1,
                    trust_score: row.get(6)?,
                    breadcrumb_count: row.get(7)?,
                })
            },
        )
        .optional()
        .map_err(|e| Error::Storage(e.to_string()))?;

        if result.is_some() {
            log::info!("✅ STORAGE: Found identity");
        } else {
            log::warn!("❌ STORAGE: Identity not found");
        }

        Ok(result)
    }

    /// Get the secret key for an identity
    pub fn get_secret_key(&self, public_key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.query_row(
            "SELECT secret_key_encrypted FROM identities WHERE public_key = ?1",
            params![public_key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| Error::Storage(e.to_string()))
    }

    /// Get encryption keys for an identity
    pub fn get_encryption_keys(&self, public_key: &str) -> Result<Option<(String, String)>> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.query_row(
            "SELECT encryption_secret, encryption_public FROM identities WHERE public_key = ?1",
            params![public_key],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| Error::Storage(e.to_string()))
    }

    /// List all identities
    pub fn list_identities(&self) -> Result<Vec<IdentitySummary>> {
        log::info!("📋 STORAGE: Listing all identities");
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let mut stmt = conn.prepare(
            r#"
            SELECT public_key, name, handle, is_default, trust_score, breadcrumb_count
            FROM identities ORDER BY is_default DESC, created_at ASC
            "#,
        )?;
        
        let rows = stmt.query_map([], |row| {
            Ok(IdentitySummary {
                public_key: row.get(0)?,
                name: row.get(1)?,
                handle: row.get(2)?,
                is_default: row.get::<_, i32>(3)? == 1,
                trust_score: row.get(4)?,
                breadcrumb_count: row.get(5)?,
            })
        })?;
        
        rows.collect::<std::result::Result<Vec<_>, _>>()
            .map_err(|e| Error::Storage(e.to_string()))
    }

    /// Set the default identity
    pub fn set_default_identity(&self, public_key: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.execute("UPDATE identities SET is_default = 0", [])?;
        conn.execute(
            "UPDATE identities SET is_default = 1 WHERE public_key = ?1",
            params![public_key],
        )?;
        
        Ok(())
    }

    /// Delete an identity
    pub fn delete_identity(&self, public_key: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        // Delete related data first
        conn.execute("DELETE FROM breadcrumbs WHERE identity_pk = ?1", params![public_key])?;
        conn.execute("DELETE FROM epochs WHERE identity_pk = ?1", params![public_key])?;
        conn.execute("DELETE FROM contacts WHERE owner_pk = ?1", params![public_key])?;
        conn.execute("DELETE FROM identities WHERE public_key = ?1", params![public_key])?;
        
        Ok(())
    }

    // ==================== Message Operations ====================

    /// Save a message
    pub fn save_message(&self, msg: &Message) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let decrypted_json = msg.decrypted.as_ref()
            .map(|d| serde_json::to_string(d).ok())
            .flatten();
        
        conn.execute(
            r#"
            INSERT OR REPLACE INTO messages 
            (id, from_pk, to_pk, payload, ephemeral_key, signature, created_at, received_at, is_read, decrypted_cache)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                msg.id,
                msg.from_pk,
                msg.to_pk,
                msg.payload,
                msg.ephemeral_key,
                msg.signature,
                msg.created_at,
                msg.received_at,
                if msg.is_read { 1 } else { 0 },
                decrypted_json,
            ],
        )?;
        
        Ok(())
    }

    /// Get messages for an identity
    pub fn get_messages(&self, identity_pk: &str, query: &MessageQuery) -> Result<Vec<Message>> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let mut sql = String::from(
            r#"
            SELECT id, from_pk, to_pk, payload, ephemeral_key, signature, created_at, received_at, is_read, decrypted_cache
            FROM messages 
            WHERE (from_pk = ?1 OR to_pk = ?1)
            "#,
        );
        
        // Track parameter index (starts at 2 since ?1 is identity_pk)
        let mut param_idx = 2;
        let mut params: Vec<&dyn rusqlite::ToSql> = vec![&identity_pk];
        
        if query.unread_only {
            sql.push_str(" AND is_read = 0");
        }
        
        // SECURITY: Use parameterized queries to prevent SQL injection
        // Never interpolate user input directly into SQL strings
        if let Some(ref peer) = query.peer_pk {
            sql.push_str(&format!(" AND (from_pk = ?{} OR to_pk = ?{})", param_idx, param_idx + 1));
            param_idx += 2;
        }
        
        sql.push_str(" ORDER BY created_at DESC");
        sql.push_str(&format!(" LIMIT {} OFFSET {}", query.limit, query.offset));
        
        let mut stmt = conn.prepare(&sql)?;
        
        // Build params vector based on what was added  
        let messages: Vec<Message> = if let Some(ref peer) = query.peer_pk {
            stmt.query_map(params![identity_pk, peer, peer], |row| {
                let decrypted_cache: Option<String> = row.get(9)?;
                let decrypted = decrypted_cache
                    .and_then(|s| serde_json::from_str(&s).ok());
                
                Ok(Message {
                    id: row.get(0)?,
                    from_pk: row.get(1)?,
                    to_pk: row.get(2)?,
                    payload: row.get(3)?,
                    ephemeral_key: row.get(4)?,
                    signature: row.get(5)?,
                    created_at: row.get(6)?,
                    received_at: row.get(7)?,
                    is_read: row.get::<_, i32>(8)? == 1,
                    decrypted,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![identity_pk], |row| {
                let decrypted_cache: Option<String> = row.get(9)?;
                let decrypted = decrypted_cache
                    .and_then(|s| serde_json::from_str(&s).ok());
                
                Ok(Message {
                    id: row.get(0)?,
                    from_pk: row.get(1)?,
                    to_pk: row.get(2)?,
                    payload: row.get(3)?,
                    ephemeral_key: row.get(4)?,
                    signature: row.get(5)?,
                    created_at: row.get(6)?,
                    received_at: row.get(7)?,
                    is_read: row.get::<_, i32>(8)? == 1,
                    decrypted,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?
        };
        
        Ok(messages)
    }

    /// Mark message as read
    pub fn mark_message_read(&self, message_id: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.execute(
            "UPDATE messages SET is_read = 1 WHERE id = ?1",
            params![message_id],
        )?;
        
        Ok(())
    }

    /// Delete a message by ID
    ///
    /// Permanently removes the message from storage.
    /// Returns Ok(true) if message was deleted, Ok(false) if not found.
    pub fn delete_message(&self, message_id: &str) -> Result<bool> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let rows_affected = conn.execute(
            "DELETE FROM messages WHERE id = ?1",
            params![message_id],
        )?;
        
        log::info!("Deleted message {}: {} rows affected", message_id, rows_affected);
        Ok(rows_affected > 0)
    }

    /// Delete all messages with a specific peer
    ///
    /// Useful for clearing conversation history.
    pub fn delete_messages_with_peer(&self, my_pk: &str, peer_pk: &str) -> Result<u64> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        // SECURITY: Use parameterized query to prevent SQL injection
        let rows_affected = conn.execute(
            "DELETE FROM messages WHERE (from_pk = ?1 AND to_pk = ?2) OR (from_pk = ?2 AND to_pk = ?1)",
            params![my_pk, peer_pk],
        )?;
        
        log::info!("Deleted {} messages with peer {}", rows_affected, peer_pk);
        Ok(rows_affected as u64)
    }

    /// Update message with decrypted content
    pub fn update_message_decrypted(&self, message_id: &str, decrypted: &DecryptedPayload) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        let decrypted_json = serde_json::to_string(decrypted)
            .map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.execute(
            "UPDATE messages SET decrypted_cache = ?1 WHERE id = ?2",
            params![decrypted_json, message_id],
        )?;
        
        Ok(())
    }

    // ==================== Breadcrumb Operations ====================

    /// Save a breadcrumb
    pub fn save_breadcrumb(&self, identity_pk: &str, breadcrumb: &Breadcrumb) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.execute(
            r#"
            INSERT INTO breadcrumbs 
            (id, identity_pk, h3_index, h3_resolution, timestamp, prev_hash, hash, signature, source, accuracy, published)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                breadcrumb.id,
                identity_pk,
                breadcrumb.h3_index,
                breadcrumb.h3_resolution,
                breadcrumb.timestamp,
                breadcrumb.prev_hash,
                breadcrumb.hash,
                breadcrumb.signature,
                format!("{:?}", breadcrumb.source).to_lowercase(),
                breadcrumb.accuracy,
                if breadcrumb.published { 1 } else { 0 },
            ],
        )?;
        
        // Update breadcrumb count
        conn.execute(
            "UPDATE identities SET breadcrumb_count = breadcrumb_count + 1 WHERE public_key = ?1",
            params![identity_pk],
        )?;
        
        Ok(())
    }

    /// Get breadcrumb count for an identity
    pub fn get_breadcrumb_count(&self, identity_pk: &str) -> Result<u32> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.query_row(
            "SELECT COUNT(*) FROM breadcrumbs WHERE identity_pk = ?1",
            params![identity_pk],
            |row| row.get(0),
        )
        .map_err(|e| Error::Storage(e.to_string()))
    }

    // ==================== Handle Cache ====================

    /// Cache a handle resolution
    pub fn cache_handle(&self, handle: &str, resolved: &ResolvedHandle) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.execute(
            r#"
            INSERT OR REPLACE INTO handle_cache 
            (handle, public_key, encryption_key, trust_score, breadcrumb_count, cached_at)
            VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
            "#,
            params![
                handle,
                resolved.public_key,
                resolved.encryption_key,
                resolved.trust_score,
                resolved.breadcrumb_count,
            ],
        )?;
        
        Ok(())
    }

    /// Get cached handle resolution
    pub fn get_cached_handle(&self, handle: &str, max_age_seconds: u64) -> Result<Option<ResolvedHandle>> {
        let conn = self.conn.lock().map_err(|e| Error::Storage(e.to_string()))?;
        
        conn.query_row(
            r#"
            SELECT handle, public_key, encryption_key, trust_score, breadcrumb_count, cached_at
            FROM handle_cache 
            WHERE handle = ?1 
              AND datetime(cached_at, '+' || ?2 || ' seconds') > datetime('now')
            "#,
            params![handle, max_age_seconds as i64],
            |row| {
                Ok(ResolvedHandle {
                    handle: row.get(0)?,
                    public_key: row.get(1)?,
                    encryption_key: row.get(2)?,
                    trust_score: row.get(3)?,
                    breadcrumb_count: row.get(4)?,
                    from_cache: true,
                    resolved_at: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|e| Error::Storage(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_storage() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let storage = StorageManager::new(&db_path, false).unwrap();
        assert!(!storage.encrypted);
    }

    #[test]
    fn test_identity_operations() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let storage = StorageManager::new(&db_path, false).unwrap();

        // Save identity
        storage
            .save_identity("abc123", "secret", "enc_secret", "enc_public", "Test")
            .unwrap();

        // Get identity
        let identity = storage.get_identity("abc123").unwrap().unwrap();
        assert_eq!(identity.name, "Test");

        // List identities
        let list = storage.list_identities().unwrap();
        assert_eq!(list.len(), 1);
    }
}
