# Hệ thống quản lý CLB: ECOBoard và ECODesk

Mã nguồn của hai ứng dụng chạy trên Google Apps Script, dữ liệu lưu trong Google Sheet của tài khoản CLB.

- **ECOBoard**: trang công khai cho thành viên xem điểm cộng, bảng ghim, quy chế và gửi góp ý ẩn danh. Không cần đăng nhập.
- **ECODesk**: trang làm việc cho BOD, ban nhân sự và UCV. Có đăng nhập (mật khẩu hoặc Google). Gồm cộng điểm, task và nhắc việc qua Zalo, mail, báo cáo, file đăng ký log, góp ý, cài đặt.
- Cả hai cài được lên điện thoại như app nhờ trang vỏ trong `pwa/`.

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/yeu-cau.md](docs/yeu-cau.md) | Yêu cầu đã chốt với CLB |
| [docs/huong-dan-cai-dat.md](docs/huong-dan-cai-dat.md) | Cài đặt lên tài khoản Google của CLB, từng bước |
| [docs/huong-dan-cai-app.md](docs/huong-dan-cai-app.md) | Cài app lên điện thoại, bật đăng nhập Google |
| [docs/kien-truc.md](docs/kien-truc.md) | Cách hệ thống được tổ chức, các tab dữ liệu |

## Cấu trúc thư mục

```
src/            Mã chạy trên Google Apps Script (chép nguyên vào trình soạn Apps Script)
  Code.gs       Máy chủ: trang web, menu hậu kỳ, đọc ghi dữ liệu
  Logic.gs      Các hàm tính toán thuần (có kiểm thử)
  Board.html    Giao diện ECOBoard
  HauKy.html    Hộp thoại tải danh sách trong Google Sheet
  MayChuDesk.gs Máy chủ ECODesk: đăng nhập, phân quyền, cộng điểm, task, góp ý, cài đặt
  Zalo.gs       Nhắc việc qua bot Zalo
  ThongBao.gs   Gửi thông báo theo cách mỗi người chọn: Zalo, app trên điện thoại (Web Push), mail
  Mail.gs       Mail: hộp thư UCV, BOD duyệt, thư mẫu, gửi hàng loạt, hẹn giờ
  BaoCao.gs     Báo cáo, xuất Excel và tạo file đăng ký log
  Desk.html     Giao diện ECODesk
  appsscript.json  Cấu hình dự án Apps Script
pwa/            Trang vỏ trên GitHub Pages để cài app và đăng nhập Google
tests/          Kiểm thử tự động cho Logic.gs (chạy: npm test)
docs/           Tài liệu
```
