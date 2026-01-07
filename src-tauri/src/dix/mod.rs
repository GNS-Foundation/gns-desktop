//! DIX Service - Microblogging
//!
//! Handles creating, signing, and publishing posts to DIX via Supabase.

use crate::crypto::{IdentityManager, GnsIdentity};
use crate::network::ApiClient;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;

// ===========================================
// MODELS
// ===========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixPost {
    pub id: String,
    pub author: DixPostAuthor,
    pub facet: String,
    pub content: DixPostContent,
    pub engagement: DixPostEngagement,
    pub meta: DixPostMeta,
    pub thread: Option<DixPostThread>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixPostAuthor {
    #[serde(rename = "publicKey")]
    pub public_key: String,
    pub handle: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "trustScore")]
    pub trust_score: i32,
    #[serde(rename = "breadcrumbCount")]
    pub breadcrumb_count: i32,
    #[serde(rename = "isVerified")]
    pub is_verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixPostContent {
    pub text: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub mentions: Vec<String>,
    #[serde(default)]
    pub media: Vec<DixMedia>,
    #[serde(default)]
    pub links: Vec<DixLink>,
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixMedia {
    #[serde(rename = "type")]
    pub media_type: String, // 'image', 'video'
    pub url: String,
    pub alt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixLink {
    pub url: String,
    pub title: Option<String>,
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixPostEngagement {
    pub likes: i32,
    pub replies: i32,
    pub reposts: i32,
    pub quotes: i32,
    pub views: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixPostMeta {
    pub signature: String,
    #[serde(rename = "trustScoreAtPost")]
    pub trust_score_at_post: i32,
    #[serde(rename = "breadcrumbsAtPost")]
    pub breadcrumbs_at_post: i32,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DixPostThread {
    #[serde(rename = "replyToId")]
    pub reply_to_id: Option<String>,
    #[serde(rename = "quoteOfId")]
    pub quote_of_id: Option<String>,
}

// ===========================================
// SERVICE
// ===========================================

pub struct DixService {
    identity: Arc<Mutex<IdentityManager>>,
    // We construct our own Client to call Supabase directly if ApiClient is restricted,
    // but better to reuse ApiClient if possible.
    // However, ApiClient is struct-based on one base_url.
    // Dix likely uses the same base_url.
    api: Arc<ApiClient>,
}

impl DixService {
    pub fn new(identity: Arc<Mutex<IdentityManager>>, api: Arc<ApiClient>) -> Self {
        Self { identity, api }
    }

    /// Create and publish a new DIX post
    pub async fn create_post(
        &self,
        text: String,
        media: Vec<DixMedia>,
        reply_to_id: Option<String>,
    ) -> Result<DixPost, String> {
        let identity = self.identity.lock().await;
        
        // 1. Get identity info
        let public_key = identity.public_key_hex().ok_or("No identity")?;
        let handle = identity.cached_handle();
        
        // 2. Extract tags & mentions (Basic implementation)
        let tags = extract_tags(&text);
        let mentions = extract_mentions(&text);
        
        // 3. Prepare data
        let post_id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();
        
        // 4. Create canonical JSON for signing (CRITICAL: must match server/flutter)
        // Fields: id, facet_id, author_public_key, content, created_at, reply_to_id (if present)
        let mut signed_map = serde_json::Map::new();
        signed_map.insert("id".to_string(), json!(post_id));
        signed_map.insert("facet_id".to_string(), json!("dix"));
        signed_map.insert("author_public_key".to_string(), json!(public_key));
        signed_map.insert("content".to_string(), json!(text));
        signed_map.insert("created_at".to_string(), json!(created_at));
        
        if let Some(rid) = &reply_to_id {
            signed_map.insert("reply_to_id".to_string(), json!(rid));
        }
        
        let signed_data = serde_json::Value::Object(signed_map);
        
        let canonical_message = generate_canonical_json(&signed_data);
        println!("📝 [DIX] Signing Canonical Message: {}", canonical_message);
        
        // 5. Sign
        let signature = identity.sign_string(&canonical_message)
            .ok_or("Failed to sign post")?;
            
        drop(identity); // Release lock
        
        // 6. Send to Supabase via Node API
        let url = format!("{}/web/dix/publish", self.api.base_url());
        
        let payload = serde_json::json!({
            "post_id": post_id,
            "facet_id": "dix",
            "author_public_key": public_key,
            "author_handle": handle,
            "content": text,
            "media": media,
            "created_at": created_at,
            "tags": tags,
            "mentions": vec![] as Vec<String>, // TODO: Extract from text
            "signature": signature,
            "reply_to_id": reply_to_id
        });

        let response = self.api.client().post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Server returned error: {}", error_text));
        }
        
        // Log success
        println!("✅ Dix Post published: {}", post_id);
        
        // Return the post object
        Ok(DixPost {
            id: post_id,
            author: DixPostAuthor {
                public_key: public_key,
                handle: handle,
                display_name: None,
                avatar_url: None,
                trust_score: 0,
                breadcrumb_count: 0,
                is_verified: false,
            },
            facet: "dix".into(),
            content: DixPostContent {
                text,
                tags,
                mentions,
                media,
                links: vec![],
                location: None,
            },
            engagement: DixPostEngagement {
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
                views: 0,
            },
            meta: DixPostMeta {
                signature,
                trust_score_at_post: 0,
                breadcrumbs_at_post: 0,
                created_at,
            },
            thread: reply_to_id.map(|rid| DixPostThread {
                reply_to_id: Some(rid),
                quote_of_id: None,
            }),
        })
    }
    
    pub async fn get_timeline(&self, limit: u32, offset: u32) -> Result<Vec<DixPost>, String> {
        let base_url = self.api.base_url();
        let url = format!("{}/web/dix/timeline?limit={}&offset={}", base_url, limit, offset);
        
        let client = reqwest::Client::new();
        let res = client.get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
            
        let wrapper: DixResponse = res.json().await.map_err(|e| e.to_string())?;
        if !wrapper.success {
             return Err(wrapper.error.unwrap_or("Unknown error".into()));
        }
        Ok(wrapper.data.map(|d| d.posts).ok_or("No data returned")?)
    }

    pub async fn get_post(&self, post_id: &str) -> Result<DixPostData, String> {
        let base_url = self.api.base_url();
        let url = format!("{}/web/dix/post/{}", base_url, post_id);

        let client = reqwest::Client::new();
        let res = client.get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let wrapper: DixPostResponse = res.json().await.map_err(|e| e.to_string())?;
        
        if !wrapper.success {
             return Err(wrapper.error.unwrap_or("Unknown error".into()));
        }

        Ok(wrapper.data.ok_or("No data returned")?)
    }

    pub async fn like_post(&self, post_id: &str, public_key: &str, signature: &str) -> Result<(), String> {
        let url = format!("{}/web/dix/like", self.api.base_url());
        let payload = serde_json::json!({
            "post_id": post_id,
            "author_public_key": public_key,
            "signature": signature
        });

        let client = reqwest::Client::new();
        let response = client.post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
             let error_text = response.text().await.unwrap_or_default();
             println!("❌ [DIX] Like Error: {}", error_text);
             if error_text.contains("Already liked") {
                 return Ok(());
             }
             return Err(format!("Server returned error: {}", error_text));
        }

        Ok(())
    }
    
    pub async fn repost_post(&self, post_id: &str, public_key: &str, signature: &str) -> Result<(), String> {
        let url = format!("{}/web/dix/repost", self.api.base_url());
        let payload = serde_json::json!({
             "post_id": post_id,
             "author_public_key": public_key,
             "signature": signature
        });

        let client = reqwest::Client::new();
        let response = client.post(&url)
             .json(&payload)
             .send()
             .await
             .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
              let error_text = response.text().await.unwrap_or_default();
              println!("❌ [DIX] Repost Error: {}", error_text);
              if error_text.contains("Already reposted") {
                  return Ok(());
              }
              return Err(format!("Server returned error: {}", error_text));
        }

        Ok(())
    }

    pub async fn get_posts_by_user(&self, public_key: &str) -> Result<DixUserData, String> {
        let base_url = self.api.base_url();
        let url = format!("{}/web/dix/pk/{}", base_url, public_key);

        let client = reqwest::Client::new();
        let res = client.get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let wrapper: DixUserResponse = res.json().await.map_err(|e| e.to_string())?;

        if !wrapper.success {
             return Err(wrapper.error.unwrap_or("Unknown error".into()));
        }

        Ok(wrapper.data.ok_or("No data returned")?)
    }
}

// Helpers
#[derive(Deserialize)]
struct DixResponse {
    success: bool,
    data: Option<DixData>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct DixData {
    posts: Vec<DixPost>,
}

#[derive(Deserialize)]
struct DixPostResponse {
    success: bool,
    data: Option<DixPostData>,
    error: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct DixPostData {
    pub post: DixPost,
    pub replies: Vec<DixPost>,
    #[serde(rename = "replyCount")]
    pub reply_count: u32,
}

#[derive(Deserialize)]
struct DixUserResponse {
    success: bool,
    data: Option<DixUserData>,
    error: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct DixUserData {
    pub user: DixPostAuthor,
    pub posts: Vec<DixPost>,
}

fn extract_tags(text: &str) -> Vec<String> {
    // Simple regex replacement
    // In Rust we might need the regex crate, which is in Cargo.toml
    use regex::Regex;
    let re = Regex::new(r"#([a-zA-Z][a-zA-Z0-9_]*)").unwrap();
    re.captures_iter(text)
        .map(|cap| cap[1].to_string().to_lowercase())
        .collect()
}

fn extract_mentions(text: &str) -> Vec<String> {
    use regex::Regex;
    let re = Regex::new(r"@([a-zA-Z][a-zA-Z0-9_]*)").unwrap();
    re.captures_iter(text)
        .map(|cap| cap[1].to_string().to_lowercase())
        .collect()
}

/// Start with simple canonical JSON (lexicographical key order)
fn generate_canonical_json(value: &serde_json::Value) -> String {
    // Serde JSON's to_string doesn't guarantee order, but if we use BTreeMap it does?
    // Or we write a manual serializer.
    // However, `serde_json` usually prints maps in order if `preserve_order` is not enabled, 
    // but standard `serde_json::to_string` sorts keys? 
    // Actually, `serde_json` by default DOES NOT guarantee sorted keys unless you use `PreserveOrder` feature which is off by default, 
    // so it uses BTreeMap effectively? No.
    // We need a specific canonicalizer.
    // For now, let's implement a simple recursive one.
    
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => serde_json::to_string(s).unwrap(), // Quote and escape
        serde_json::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(generate_canonical_json).collect();
            format!("[{}]", items.join(","))
        }
        serde_json::Value::Object(map) => {
            let mut pairs: Vec<(String, String)> = map.iter()
                .map(|(k, v)| (k.clone(), generate_canonical_json(v)))
                .collect();
            pairs.sort_by(|a, b| a.0.cmp(&b.0));
            let content = pairs.iter()
                .map(|(k, v)| format!("\"{}\":{}", k, v))
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{}}}", content)
        }
    }
}
