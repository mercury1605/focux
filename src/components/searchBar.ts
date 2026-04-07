/**
 * Khởi tạo các sự kiện cho thanh tìm kiếm.
 * * @param inputElement Thẻ input HTML của thanh search
 * @param onSearch Hàm callback được gọi khi nội dung search thay đổi
 */
export function setupSearchBar(
  inputElement: HTMLInputElement,
  onSearch: (query: string) => void
) {
  // 1. Lắng nghe sự kiện gõ phím
  inputElement.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    const query = target.value.trim(); // Loại bỏ khoảng trắng thừa ở 2 đầu

    // Gọi hàm onSearch (lưu ý: hàm được truyền vào từ main.ts đã được bọc qua debounce)
    onSearch(query);
  });

  // 2. Lắng nghe các phím điều hướng đặc biệt (Chuẩn bị cho tính năng chọn kết quả)
  inputElement.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Tab':
        event.preventDefault(); // Ngăn con trỏ nhảy lung tung
        // TODO: Phát sự kiện báo cho file listResults.ts di chuyển highlight xuống dưới
        console.log('Chuyển focus xuống mục tiếp theo');
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        // TODO: Phát sự kiện di chuyển highlight lên trên
        console.log('Chuyển focus lên mục phía trên');
        break;
        
      case 'Enter':
        event.preventDefault();
        // TODO: Kích hoạt (Mở app/file) mục đang được highlight
        console.log('Mở ứng dụng đang được chọn');
        break;
    }
  });
}