# Kiến trúc hệ thống

## Tổng thể

- Một file **Google Sheet "ECO - Dữ liệu"** trên Drive của tài khoản CLB là cơ sở dữ liệu. Mỗi tab là một bảng.
- Một **dự án Apps Script gắn với file đó** chứa toàn bộ mã trong thư mục `src/`.
- Dự án được triển khai thành **ứng dụng web**, chạy dưới quyền tài khoản CLB, ai có link cũng mở được.
  - `…/exec` mở ECOBoard.
  - `…/exec?app=desk` mở ECODesk (đang xây dựng).
- Trong file Google Sheet có menu **ECO hậu kỳ → Tải danh sách lên hệ thống**. Đây là thao tác duy nhất không làm trên giao diện app.

## Các tab dữ liệu

Tên cột viết tiếng Việt không dấu, không cách. Không có cột mã (id): thành viên phân biệt bằng họ tên, các bản ghi khác phân biệt bằng thời gian.

| Tab | Cột | Ghi chú |
|---|---|---|
| ThanhVien | HoVaTen, Lop, Ban, ChucVu, NgaySinh, SoDienThoaiCaNhan, SoDienThoaiPhuHuynh, Email, LinkFacebook, TenFacebook, NoiSong | Danh sách hiện tại. Bị ghi đè mỗi lần tải danh sách. |
| LichSuDiem | ThoiGian, HoVaTen, LoaiHoatDong, TenHoatDong, Diem, NguoiCong, NhiemKy, HocKy | Mỗi lần cộng điểm là một dòng. Không bao giờ xoá. Điểm được ghi lại tại thời điểm cộng, nên đổi số điểm của loại hoạt động không làm đổi lịch sử. |
| KyHoatDong | NhiemKy, HocKy, BatDau, KieuTaiLen | Dòng cuối là kỳ hiện tại. |
| LuuTruThanhVien | NhiemKy, HocKy, HoVaTen, Ban | Danh sách thành viên ở đầu mỗi học kỳ, dùng để biết ai được xem điểm học kỳ 1. |
| LoaiHoatDong | TenLoai, Diem | Staff, Log, Tham gia hoạt động, Seeding. |
| BangGhim | TieuDe, DuongDan | Link ghim trên ECOBoard. |
| GopY | ThoiGian, NoiDung, DaDoc | Góp ý ẩn danh. |
| TaiKhoan | Email, HoVaTen, VaiTro, MatKhau, Muoi, NgayTao | Tài khoản ECODesk. Mật khẩu chỉ lưu dạng đã băm. |
| CaiDat | Khoa, GiaTri | Các cài đặt dạng khoá và giá trị (ví dụ QuyChe, LinkSheetThanhVien). |

## Tải danh sách thành viên (hậu kỳ)

1. Đọc tab nguồn, tìm dòng tiêu đề trong 10 dòng đầu, nhận cột theo **tên** (bỏ dấu, không phân biệt hoa thường), nên đổi thứ tự cột vẫn chạy. Cột "Ghi chú" và các cột lạ bị bỏ qua.
2. Bắt buộc có cột "Họ và tên" và "Ban". Trùng tên thì dừng và báo dòng bị trùng.
3. Theo kiểu tải:
   - **Sau tuyển đợt 1**: mở nhiệm kỳ mới (đặt tên theo năm học, từ tháng 8 là năm học mới), học kỳ 1.
   - **Sau tuyển đợt 2**: cùng nhiệm kỳ, học kỳ 2.
   - **Cập nhật**: không đổi kỳ.
4. Ghi đè tab ThanhVien. Điểm "về 0" vì ECOBoard chỉ cộng các dòng LichSuDiem của kỳ hiện tại, lịch sử cũ vẫn còn nguyên.
5. Đồng bộ tài khoản BOD: ai có Ban = BOD và có email thì được tạo tài khoản với mật khẩu mặc định; ai không còn là BOD thì bị gỡ tài khoản BOD.

## ECOBoard

Máy chủ chỉ trả về họ tên, lớp, ban và điểm. Ngày sinh, số điện thoại, email, Facebook, nơi sống không bao giờ được gửi ra trang công khai. Người không còn trong danh sách không hiện trên ECOBoard. Dữ liệu bảng điểm được nhớ tạm 60 giây để trang tải nhanh.
