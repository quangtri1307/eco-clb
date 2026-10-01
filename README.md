# Hệ thống quản lý CLB: ECOBoard và ECODesk

Mã nguồn của hai ứng dụng chạy trên Google Apps Script, dữ liệu lưu trong Google Sheet của tài khoản CLB.

- **ECOBoard**: trang công khai cho thành viên xem điểm cộng, bảng ghim, quy chế và gửi góp ý ẩn danh. Không cần đăng nhập.
- **ECODesk**: trang làm việc cho ban điều hành, ban nhân sự và ứng cử viên. Có đăng nhập. *(đã có: đăng nhập, cộng điểm, góp ý, cài đặt; đang làm: task, mail, báo cáo, file log)*

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/yeu-cau.md](docs/yeu-cau.md) | Yêu cầu đã chốt với CLB |
| [docs/huong-dan-cai-dat.md](docs/huong-dan-cai-dat.md) | Cài đặt lên tài khoản Google của CLB, từng bước |
| [docs/kien-truc.md](docs/kien-truc.md) | Cách hệ thống được tổ chức, các tab dữ liệu |

## Cấu trúc thư mục

```
src/            Mã chạy trên Google Apps Script (chép nguyên vào trình soạn Apps Script)
  Code.gs       Máy chủ: trang web, menu hậu kỳ, đọc ghi dữ liệu
  Logic.gs      Các hàm tính toán thuần (có kiểm thử)
  Board.html    Giao diện ECOBoard
  HauKy.html    Hộp thoại tải danh sách trong Google Sheet
  Desk.gs       Máy chủ ECODesk: đăng nhập, phân quyền, cộng điểm, task, góp ý, cài đặt
  Zalo.gs       Nhắc việc qua bot Zalo
  Mail.gs       Mail: hộp thư ứng cử viên, BOD duyệt, thư mẫu, gửi hàng loạt, hẹn giờ
  Desk.html     Giao diện ECODesk
  appsscript.json  Cấu hình dự án Apps Script
tests/          Kiểm thử tự động cho Logic.gs (chạy: npm test)
docs/           Tài liệu
```
