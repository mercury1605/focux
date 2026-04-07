/**
 * Trì hoãn việc thực thi một hàm cho đến khi một khoảng thời gian 'wait' 
 * đã trôi qua kể từ lần cuối cùng hàm debounce được gọi.
 * * @param func Hàm cần thực thi
 * @param wait Thời gian chờ (milliseconds)
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    // Hàm sẽ chạy sau khi hết thời gian chờ
    const later = () => {
      timeout = null;
      func(...args);
    };

    // Nếu người dùng vẫn đang gõ, hủy cái timeout cũ đi...
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    // ...và thiết lập một cái timeout mới
    timeout = setTimeout(later, wait);
  };
}