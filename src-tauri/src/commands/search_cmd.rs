use crate::system::file_indexer;

#[tauri::command]
pub fn search_system(query: &str) -> Result<Vec<String>, String> {
    // Chỉ gọi hàm từ module lõi, đổi lỗi thành String để JS dễ bắt (catch)
    file_indexer::find_files(query).map_err(|e| e.to_string())
}