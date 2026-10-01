# Hướng dẫn cài đặt lên tài khoản Google của CLB

Làm một lần duy nhất, khoảng 15 phút. Đăng nhập **tài khoản Google của CLB** trước khi bắt đầu.

## 1. Tạo file dữ liệu

1. Vào Google Drive, tạo một Google Sheet mới, đặt tên **ECO - Dữ liệu**.
2. Trong file đó, bấm **Tiện ích mở rộng → Apps Script**. Một tab mới mở ra.

## 2. Chép mã vào Apps Script

Trên GitHub, mở từng file trong thư mục `src/`, bấm nút **Copy raw file** (biểu tượng hai tờ giấy ở góc phải) rồi dán vào Apps Script:

| File trên GitHub | Trong Apps Script |
|---|---|
| `src/Code.gs` | Dán đè vào file `Mã.gs` có sẵn (hoặc `Code.gs`) |
| `src/Logic.gs` | Bấm **+ → Tập lệnh**, đặt tên `Logic` |
| `src/Board.html` | Bấm **+ → HTML**, đặt tên `Board` |
| `src/HauKy.html` | Bấm **+ → HTML**, đặt tên `HauKy` |
| `src/appsscript.json` | Bấm **Cài đặt dự án** (bánh răng) → bật **Hiển thị tệp kê khai "appsscript.json"**, quay lại trình soạn, mở `appsscript.json` và dán đè |

Bấm biểu tượng **Lưu** (đĩa mềm).

## 3. Tải danh sách thành viên lần đầu

1. Quay lại file Google Sheet, tải lại trang (F5). Trên thanh menu xuất hiện **ECO hậu kỳ**.
2. Bấm **ECO hậu kỳ → Tải danh sách lên hệ thống**.
3. Lần đầu Google sẽ hỏi quyền. Bấm **Tiếp tục**, chọn tài khoản CLB. Nếu thấy cảnh báo "Google chưa xác minh ứng dụng này", bấm **Nâng cao → Đi tới … (không an toàn)** rồi **Cho phép**. Cảnh báo này xuất hiện vì đây là ứng dụng tự viết của CLB.
4. Bấm lại menu lần nữa. Dán link sheet danh sách thành viên, chọn **Sau tuyển đợt 1**, nhập mật khẩu mặc định cho BOD, bấm **Tải lên**.

## 4. Mở ECOBoard cho mọi người

1. Trong Apps Script, bấm **Triển khai → Tùy chọn triển khai mới**.
2. Bấm bánh răng cạnh "Chọn loại", chọn **Ứng dụng web**.
3. **Thực thi với tư cách**: Tôi (tài khoản CLB). **Người có quyền truy cập**: Bất kỳ ai.
4. Bấm **Triển khai**, sao chép **URL ứng dụng web**. Đó là link ECOBoard để gửi cho thành viên.

## Khi có mã mới

Chép lại các file đã thay đổi như bước 2, lưu, rồi vào **Triển khai → Quản lý các lần triển khai → biểu tượng bút chì → Phiên bản: Phiên bản mới → Triển khai**. Link ECOBoard giữ nguyên.
