# Yêu cầu hệ thống quản lý CLB (ĐÃ CHỐT 30/09/2026)

Cập nhật: 30/09/2026. Đây là các chức năng lớn; chức năng nhỏ sẽ khai thác thêm khi làm.

## 1. Tổng quan
- Hai app chạy trên Google Apps Script, mã nguồn lưu trên GitHub.
- Dữ liệu lưu trên Google Sheets thuộc tài khoản Google chung của CLB.
- **ECOBoard**: cho thành viên CLB, không cần đăng nhập.
- **ECODesk**: cho BOD, ban nhân sự (HR) và UCV, có đăng nhập.
- Cả hai app dùng được trên **web máy tính** và cài như **app trên điện thoại (PWA)**.

## 2. Nguyên tắc thiết kế
- Chạy được khoảng 5 năm mà không cần bảo trì, vì sau này có thể không ai biết code hay dùng AI thành thạo.
- Mọi thứ hay thay đổi đều làm trên giao diện app: loại hoạt động và số điểm, quy chế, link ghim, người được quyền, cài đặt nhắc việc, mã bot Zalo, link file mẫu log.
- Danh sách ban, chức vụ, học kỳ, nhiệm kỳ: app tự nhận diện khi tải danh sách thành viên, không cần cài đặt tay.
- Người dùng không mở sheet, không sửa code. Sheet chỉ là nơi hệ thống cất dữ liệu.
- Ngoại lệ duy nhất: **nút hậu kỳ** nằm trong file Google Sheet (xem mục 7).
- Mọi cài đặt trong ECODesk đều do BOD sửa được.
- Có tài liệu hướng dẫn bàn giao bằng lời dễ hiểu.

## 3. Người dùng
| Nhóm | Số người | App | Được làm gì |
|---|---|---|---|
| Thành viên CLB | 60–80 | ECOBoard | Xem điểm, bảng ghim, quy chế, góp ý ẩn danh |
| BOD (cột Ban = "BOD") | 7 | ECODesk | Cộng điểm, task, duyệt và gửi mail, báo cáo, mọi cài đặt |
| Ban nhân sự (HR) | 6–10 | ECODesk | Chỉ task (không cộng điểm) |
| UCV | chưa biết | ECODesk | Chỉ mail |

- UCV là thành viên CLB đăng ký ứng tuyển qua Google Form.
- Thành viên thường không biết ECODesk tồn tại.

## 4. ECOBoard (công khai, không đăng nhập)
- Danh sách điểm cộng của thành viên và lịch sử cộng điểm.
- Lọc theo ban, theo tên; sắp xếp điểm cao → thấp hoặc ngược lại.
- Chỉ hiện thông tin không nhạy cảm: họ tên, lớp, ban, điểm. Không hiện ngày sinh, số điện thoại, nơi sống, Facebook.
- Bảng ghim các link cần thiết, và quy chế cộng điểm (BOD sửa trong ECODesk).
- Khung góp ý ẩn danh (BOD đọc trong ECODesk).

## 5. ECODesk (có đăng nhập)

### 5.1 Cộng điểm (chỉ BOD, cho mọi thành viên)
- Loại hoạt động hiện có: staff, log, tham gia hoạt động, seeding. Task không phải loại hoạt động và không cộng điểm.
- Mỗi loại có số điểm cố định; BOD chỉ chọn loại, không nhập điểm. BOD thêm/sửa loại và số điểm trong cài đặt.
- Mỗi lần cộng ghi: loại hoạt động, người được cộng, người cộng (tự lấy từ tài khoản đăng nhập), thời gian (tự lấy lúc bấm gửi, không hỏi), tên hoạt động (không bắt buộc).
- Chọn được nhiều người một lần; danh sách chọn người có tìm theo tên và lọc theo ban.
- Ví dụ seeding: loại hoạt động = "seeding", tên hoạt động = "comment" hoặc "react". Báo cáo tách được theo tên hoạt động.

### 5.2 Task (BOD và HR)
- Mục đích: nhắc việc cho BOD, và nhắc HR để HR nhắc thủ công thành viên ban khác qua Messenger.
- HR hoặc BOD đều tạo, sửa, đánh dấu hoàn thành, huỷ được.
- Tạo hàng loạt: một lần tạo cùng một task cho nhiều người phụ trách.
- Trạng thái: **Đã giao**, **Sắp đến hạn**, **Trễ hạn**, **Đã xong**, **Đã huỷ** (không dùng "đang làm" vì không biết họ có đang làm hay không).
- Thế nào là "sắp đến hạn" (còn bao nhiêu ngày) đặt trong cài đặt.
- Thông tin: tên, mô tả (không bắt buộc), hạn chót, người phụ trách.
- Tự ghi thời gian và người tạo: BOD tạo → "giao task"; HR tạo → "nhập task" (nhập hộ BOD).
- Nhắc qua **bot Zalo** cho cả BOD và HR (không dùng email vì dễ bị bỏ sót).
- Mỗi năm Head HR tạo bot bằng tài khoản Zalo của mình; mã bot và các ID nhập trong cài đặt ECODesk. Kèm hướng dẫn từng bước.
- Thời điểm nhắc được cài đặt trong app.
- Cần kiểm tra khi làm (suy luận): có thể mỗi người phải nhắn bot một lần thì bot mới nhắn lại được.

### 5.3 Mail (UCV và BOD)
- Mọi mail gửi dưới danh nghĩa Gmail chung của CLB.
- UCV chưa được vào tài khoản CLB nên dùng hộp thư trong ECODesk. Hộp thư này **tái tạo đầy đủ tính năng như Gmail thật**: soạn, gửi, trả lời, chuyển tiếp, thư nháp, hộp thư đến, đã gửi, và các tính năng khác.
- Đọc thư không cần duyệt. Mọi thao tác làm thay đổi hộp thư (gửi, trả lời, chuyển tiếp, xoá, lưu trữ, gắn nhãn...) phải được BOD duyệt trước. BOD gắn trạng thái (đã duyệt, cần sửa lại, từ chối...) để UCV biết và sửa.
- BOD cài đặt UCV được xem toàn bộ hộp thư CLB hay chỉ thư của mình.
- BOD **không** có hộp thư đến, soạn thư, thư đã gửi trong ECODesk. Phần mail của BOD gồm:
  - **Duyệt việc của UCV.**
  - **Thư mẫu**: soạn và lưu nhiều thư nháp, chia vào các thư mục để sắp xếp.
  - **Gửi hàng loạt** từ một thư mẫu, có cá nhân hoá. Nguồn người nhận:
    - Danh sách thành viên CLB.
    - Danh bạ các CLB khác, các bên hay gửi (quản lý trong cài đặt).
    - Nhập email thủ công.
    - Dán link một Google Sheet → chọn các dòng muốn gửi → xác nhận cột nào là email. Chỗ nào trong thư ghi {TenCot} khớp tên cột của sheet thì tự thay bằng dữ liệu dòng đó.
  - **Đã lên lịch**: quản lý các đợt gửi đã hẹn giờ (xem, sửa, huỷ).
- Giới hạn của Google: Gmail thường gửi được khoảng 100 người nhận/ngày qua app, nên mỗi ngày chỉ nên gửi một đợt lớn.

### 5.4 Báo cáo (BOD)
- Nội dung: điểm; task đã xong/trễ hạn; số lần làm log, staff; số lần tham gia hoạt động; số lần seeding (tách theo bình luận, react...).
- Xem theo: từng thành viên, từng ban (PR CAP/DES/PHO gộp thành PR), cả CLB.
- Chọn khoảng thời gian: tháng, học kỳ, nhiệm kỳ, hoặc tự chọn.
- Hiển thị: bảng tổng cho cả khoảng thời gian, và biểu đồ thể hiện thay đổi trong khoảng đó.
- Xuất ra file **Excel**.
- Không có nút "sang học kỳ/nhiệm kỳ mới" riêng. Mốc học kỳ/nhiệm kỳ được xác định bởi kiểu tải danh sách ở nút hậu kỳ (mục 7).

## 6. Dữ liệu thành viên
- Sheet nguồn có các cột: Họ và tên, Lớp, Ban, Chức vụ, Ngày sinh, Số điện thoại cá nhân, Số điện thoại phụ huynh, Email, Link Facebook, Tên Facebook, Nơi sống, Ghi chú.
- App nhận diện theo **tên cột**: đổi thứ tự vẫn chạy, đổi tên cột thì không.
- Cột "Ghi chú" không tải lên.
- Họ và tên là mã phân biệt từng người (không bao giờ trùng).
- Ban hiện có: BOD, PG, PR CAP, PR DES, PR PHO, HR, AD. PR có 3 mảng, gộp khi lọc và thống kê.
- Chức vụ hiện có: Pres, Vice pres, Head PG, Head PR CAP, Head PR DES, Head PR PHO, Head HR, Head AD, Mem.
- Danh sách ban, chức vụ do app tự nhận diện từ dữ liệu khi tải lên. Ban mới, chức vụ mới tự xuất hiện.
- Gộp ban: các ban cùng chữ đầu (PR CAP, PR DES, PR PHO) tự gộp thành "PR" khi lọc và thống kê.
- Thành viên sửa thông tin của mình trên sheet nguồn; Head HR bấm nút hậu kỳ để cập nhật vào hệ thống.

## 7. Hậu kỳ, đăng nhập và phân quyền
- **Nút hậu kỳ**: một nút trong file Google Sheet (tài khoản CLB). Gom việc tải danh sách thành viên, cập nhật danh sách thành viên, tải danh sách UCV vào một nút, chạy tự động.
- Khi tải danh sách: ai có Ban = "BOD" được cấp tài khoản ECODesk ngay.
- Thành viên ban nhân sự được BOD chọn trong app sau.
- Khi tải danh sách thành viên, chọn 1 trong 3 kiểu:
  1. **Sau tuyển đợt 1**: reset điểm trên ECOBoard về 0. Lịch sử điểm vẫn lưu trên sheet nhiều năm.
  2. **Sau tuyển đợt 2**: reset điểm; ai vẫn còn trong CLB so với danh sách trước thì có nút xem điểm học kỳ 1.
  3. **Cập nhật**: không reset gì.
- Tuyển đợt 1 = bắt đầu nhiệm kỳ mới và học kỳ 1; tuyển đợt 2 = bắt đầu học kỳ 2. Báo cáo dựa vào các mốc này để chia học kỳ, nhiệm kỳ.
- Người không còn trong danh sách mới: biến mất khỏi ECOBoard VÀ khỏi báo cáo. Các dòng lịch sử cộng điểm của họ vẫn giữ trong sheet (chỉ để lưu trữ).
- Tải danh sách UCV: làm sau, khi đã chốt cấu trúc sheet form ứng tuyển.
- Đăng nhập ECODesk bằng **cả hai cách**: Gmail cá nhân, hoặc email + mật khẩu.
- Mật khẩu mặc định do người tải danh sách nhập, giống nhau cho mọi BOD, tự gửi nhau qua Messenger, không bắt buộc đổi.
- UCV và HR tự đổi mật khẩu của mình; BOD đổi được mật khẩu của mọi người.
- Rủi ro Van đã biết và chấp nhận: ai biết mật khẩu mặc định thì vào được tài khoản BOD chưa đổi.

## 8. Cách tổ chức dữ liệu (database)
- Không dồn vào 1 tab. Chia nhiều tab, tổ chức chuyên nghiệp như app thương mại (vd: thành viên, lịch sử cộng điểm, loại hoạt động, task, mail chờ duyệt, góp ý, link ghim, cài đặt, tài khoản).
- Tên cột: tiếng Việt không dấu, không cách (vd: HoVaTen, SoDienThoaiCaNhan, ThoiGianCong).
- Không thêm cột mã (id) rườm rà cho mỗi hàng. Dùng thứ tự nhiên để phân biệt: họ tên cho thành viên, thời gian tạo cho task/mail/góp ý.

## 9. Tính năng tạo file đăng ký làm log (BOD)
- BOD tạo file đăng ký làm log từ một **Google Sheet mẫu**; link file mẫu nhập trong cài đặt.
- App tự lấy từ danh sách thành viên: họ tên, ban, số điện thoại cá nhân.
- BOD bấm nút thêm hoặc xoá buổi rồi điền tên từng buổi (không nhập số buổi).
- File tạo ra lưu vào thư mục Google Drive đặt trong cài đặt; tạo xong app hiện link ngay.

## 10. Giao diện
- Màu chủ đạo: **#274e13** (xanh lá đậm).
- ECOBoard dùng logo CLB; ECODesk dùng logo CLB chỉnh lại một chút. Logo xử lý sau khi viết code.
- Menu và cài đặt làm chuyên nghiệp, chia nhóm rõ ràng. Cài đặt dạng bấm vào từng mục để đi sang trang con (như điện thoại), không dồn hết một trang; có ô tìm kiếm trong cài đặt.

## 11. Còn để sau
- Cấu trúc sheet danh sách UCV và cách tải lên.
- Các chức năng nhỏ của từng phần.
