# Kiến trúc hệ thống

## Tổng thể

- Một file **Google Sheet "ECO - Dữ liệu"** trên Drive của tài khoản CLB là cơ sở dữ liệu. Mỗi tab là một bảng.
- Một **dự án Apps Script gắn với file đó** chứa toàn bộ mã trong thư mục `src/`.
- Dự án được triển khai thành **ứng dụng web**, chạy dưới quyền tài khoản CLB, ai có link cũng mở được.
  - `…/exec` mở ECOBoard.
  - `…/exec?app=desk` mở ECODesk.
- Trong file Google Sheet có menu **ECO hậu kỳ → Tải danh sách lên hệ thống**. Đây là thao tác duy nhất không làm trên giao diện app.

## Ghi cùng lúc và tốc độ (`src/Code.gs`)

- **Khoá ghi:** mọi chỗ ghi vào sheet chạy trong khoá chung (`voiKhoa_`, hoặc `layKhoa_`/`traKhoa_`). Hai người bấm lưu cùng lúc thì lần lượt từng người ghi, không ai ghi đè hay chen vào dòng của người kia. Việc đọc rồi sửa (tìm dòng rồi ghi, lọc bảng rồi ghi đè) phải nằm trọn trong một khoá. Gọi lồng nhau vẫn được. Chờ quá 30 giây thì báo "Đang có nhiều người lưu cùng lúc". Việc chạy lâu (gửi thư hẹn giờ, nhắc việc) chỉ khoá lúc ghi, không khoá lúc gửi.
- **Nhớ tạm trên máy chủ:** `docBang_` đọc mỗi bảng một lần trong một lần chạy. Bốn bảng ít đổi (`BANG_NHO_TAM`: CaiDat, TaiKhoan, ThanhVien, LoaiHoatDong) còn được nhớ 10 phút giữa các lần chạy. Ghi vào bảng nào (qua `bangDuLieu_`) thì bản nhớ của bảng đó bị bỏ ngay; sửa tay trên sheet thì `onEdit` bỏ giúp. Trong khoá luôn đọc thẳng từ sheet.
- **Mở app nhanh:** ECODesk hỏi máy chủ một lần (`moDesk`: người dùng + trang chào). Máy nhớ kết quả lần mở trước (`eco_lan_mo`) nên lần sau hiện ngay rồi mới cập nhật. Sau khi mở, app lấy sẵn dữ liệu các trang trên thanh dưới; dữ liệu đọc của vài trang (`DOC_NHANH`) được giữ 60 giây trên máy, và bị bỏ hết ngay khi người dùng lưu, sửa hay xoá bất cứ gì.

## Các tab dữ liệu

Tên cột viết tiếng Việt không dấu, không cách. Không có cột mã (id): thành viên phân biệt bằng họ tên, các bản ghi khác phân biệt bằng thời gian.

| Tab | Cột | Ghi chú |
|---|---|---|
| ThanhVien | HoVaTen, Lop, Ban, ChucVu, NgaySinh, SoDienThoaiCaNhan, SoDienThoaiPhuHuynh, Email, LinkFacebook, TenFacebook, NoiSong | Danh sách hiện tại. Bị ghi đè mỗi lần tải danh sách. |
| ThanhVienCu | các cột của ThanhVien, NgayRoi | Hồ sơ đầy đủ của người không còn trong danh sách mới (tự thêm khi tải danh sách). Ai quay lại CLB thì tự bỏ khỏi đây. |
| LichSuDiem | ThoiGian, HoVaTen, LoaiHoatDong, TenHoatDong, Diem, NguoiCong, NhiemKy, HocKy | Mỗi lần cộng điểm là một dòng. Không bao giờ xoá. Điểm được ghi lại tại thời điểm cộng, nên đổi số điểm của loại hoạt động không làm đổi lịch sử. |
| KyHoatDong | NhiemKy, HocKy, BatDau, KieuTaiLen | Dòng cuối là kỳ hiện tại. |
| LuuTruThanhVien | NhiemKy, HocKy, HoVaTen, Ban | Danh sách thành viên ở đầu mỗi học kỳ, dùng để biết ai được xem điểm học kỳ 1. |
| LoaiHoatDong | TenLoai, Diem | Mặc định Staff, Log, Tham gia hoạt động; BOD thêm hoặc sửa trong Cài đặt. |
| BangGhim | TieuDe, DuongDan | Link ghim trên ECOBoard. |
| GopY | ThoiGian, NoiDung, DaDoc | Góp ý ẩn danh. |
| TaiKhoan | Email, HoVaTen, VaiTro, MatKhau, Muoi, NgayTao, NhanThongBao, GiaoDien | Tài khoản ECODesk. Mật khẩu chỉ lưu dạng đã băm. `NhanThongBao`: các cách nhận thông báo (`zalo`, `app`, `mail`, cách nhau bằng dấu phẩy, trống là `zalo`, riêng UCV trống là `mail`). `GiaoDien`: sáng/tối/theo máy của từng người. |
| CaiDat | Khoa, GiaTri | Các cài đặt dạng khoá và giá trị (ví dụ QuyChe, LinkSheetThanhVien). |
| Task | ThoiGianTao, TenTask, MoTa, HanChot, NguoiPhuTrach, NguoiTao, KieuTao, TrangThai, ThoiGianXong | Mỗi người phụ trách một dòng. Nhận diện bằng thời gian tạo và người phụ trách. |
| KetNoiZalo | HoVaTen, MaKetNoi, ChatId, TenZalo, ThoiGianKetNoi | Ai đã kết nối bot Zalo (mọi tài khoản ECODesk đều có mã kết nối). |
| ThietBi | Email, DiaChi, Khoa, TenMay, ThoiGian, LayCuoi | Điện thoại/máy đã bật thông báo của app (địa chỉ đẩy tin của trình duyệt và mã riêng của máy). |
| ThongBao | ThoiGian, Email, TieuDe, NoiDung | Thông báo app đã gửi, để máy lấy nội dung. Tự xoá sau 30 ngày. |
| ViecMail | ThoiGian, NguoiTao, ThaoTac, MaThu, TieuDeThu, Den, Cc, Bcc, TieuDe, NoiDung, Nhan, DinhKem, TrangThai, GhiChu, NguoiDuyet, ThoiGianDuyet, TuyChon | Mỗi thao tác mail của UCV (nháp, chờ duyệt, đã duyệt…). MaThu là mã luồng thư của Gmail. TuyChon (JSON) ghi thư viết dạng HTML và có trích dẫn thư cũ hay không. |
| DanhBa | Nhom, Ten, Email, GhiChu | Danh bạ gửi hàng loạt (CLB khác, đối tác). |
| FileLog | ThoiGian, TenFile, DuongDan, SoNguoi, SoBuoi, NguoiTao | Các file đăng ký log đã tạo. |
| LichGui | ThoiGianTao, ThoiGianGui, TieuDe, NoiDung, NguoiNhan, MoTaNguon, NguoiTao, TrangThai, KetQua, MaNhap | Thư hàng loạt đã hẹn giờ. NguoiNhan là danh sách người nhận dạng JSON. MaNhap là mã thư nháp Gmail; đến giờ gửi mới đọc lại thư nháp nên sửa trong Gmail trước giờ gửi vẫn được. |

Tab mới thêm ở bản cập nhật sau sẽ tự được tạo ở lần dùng đầu tiên.

## Tải danh sách thành viên (hậu kỳ)

1. Đọc tab nguồn, tìm dòng tiêu đề trong 10 dòng đầu, nhận cột theo **tên** (bỏ dấu, không phân biệt hoa thường), nên đổi thứ tự cột vẫn chạy. Cột "Ghi chú" và các cột lạ bị bỏ qua.
2. Bắt buộc có cột "Họ và tên" và "Ban". Trùng tên thì dừng và báo dòng bị trùng.
3. Theo kiểu tải:
   - **Sau tuyển đợt 1**: mở nhiệm kỳ mới (đặt tên theo năm học, từ tháng 8 là năm học mới), học kỳ 1.
   - **Sau tuyển đợt 2**: cùng nhiệm kỳ, học kỳ 2.
   - **Cập nhật**: không đổi kỳ.
4. Chuyển hồ sơ người không còn trong danh sách sang tab ThanhVienCu, rồi ghi đè tab ThanhVien. Điểm "về 0" vì ECOBoard chỉ cộng các dòng LichSuDiem của kỳ hiện tại, lịch sử cũ vẫn còn nguyên.
5. Đồng bộ tài khoản BOD: ai có Ban = BOD và có email thì được tạo tài khoản với mật khẩu mặc định; ai không còn là BOD thì bị gỡ tài khoản BOD.

## ECOBoard

Máy chủ chỉ trả về họ tên, lớp, ban và điểm. Ngày sinh, số điện thoại, email, Facebook, nơi sống không bao giờ được gửi ra trang công khai. Người không còn trong danh sách không hiện trên ECOBoard. Dữ liệu bảng điểm được nhớ tạm 60 giây để trang tải nhanh.

## ECODesk

### Đăng nhập và phân quyền

- Đăng nhập bằng email và mật khẩu. Mật khẩu lưu dạng băm SHA-256 lặp 300 lần kèm chuỗi muối riêng cho từng tài khoản.
- Sai mật khẩu 8 lần liên tiếp thì khoá email đó 15 phút.
- Đăng nhập thành công tạo một mã phiên ngẫu nhiên, lưu trong Script Properties của dự án Apps Script, hết hạn sau 30 ngày. Trình duyệt giữ mã phiên để lần sau không phải đăng nhập lại.
- Mỗi lần gọi máy chủ đều kiểm tra lại tài khoản trong tab TaiKhoan, nên gỡ tài khoản là mất quyền ngay.
- Quyền theo vai trò (xem `QUYEN` trong `Logic.gs`): BOD dùng mọi chức năng; ban nhân sự (HR) chỉ dùng Task; UCV chỉ dùng Mail.
- Tài khoản BOD đi theo danh sách thành viên (cột Ban = BOD). Tài khoản ban nhân sự do BOD thêm trong Cài đặt.

### Cộng điểm

- BOD chọn một loại hoạt động và nhiều người. Mỗi người thành một dòng LichSuDiem với điểm của loại tại lúc cộng, người cộng lấy từ tài khoản đăng nhập, thời gian lấy lúc bấm.
- Xoá một lần cộng nhầm: nhận diện dòng bằng thời gian cộng và họ tên (không có cột mã).

### Task

- BOD và ban nhân sự đều tạo, sửa, đánh dấu xong, huỷ, mở lại được. Chọn nhiều người thì mỗi người một task.
- `KieuTao` là "Giao task" nếu BOD tạo, "Nhập task" nếu ban nhân sự tạo.
- Sheet chỉ lưu trạng thái Đã giao, Đã xong, Đã huỷ. "Sắp đến hạn" và "Trễ hạn" được tính mỗi lần xem, từ hạn chót và cài đặt số ngày.
- Task đã xong hoặc đã huỷ chỉ hiện trên ECODesk trong 120 ngày, nhưng vẫn nằm trong sheet để làm báo cáo.

### Thông báo (`src/ThongBao.gs`)

- Nhắc deadline gửi theo cách mỗi người chọn (ít nhất một): Zalo, app trên điện thoại, mail. BOD nhận task của mình và task mới được giao; ban nhân sự nhận task của thành viên để nhắc lại. `guiThongBao_` gửi theo từng cách.
- Các thông báo khác chỉ gửi qua mail (`guiMailThongBao_`): góp ý mới và thư UCV chờ duyệt cho mọi BOD (bật/tắt ở Cài đặt > Báo qua mail cho BOD), kết quả duyệt thư cho UCV.
- Thông báo tách hai trang (`src/DeskTrangChu.html`, `veTrangThongBao(goc, 'toi'|'khac')`): "Thông báo của tôi" (BOD mở trong Cài đặt > Cá nhân, HR mở từ Menu) để chọn cách nhận, kết nối Zalo, bật app, xem và gỡ thiết bị của mình, gửi thử; "Thông báo của BOD và HR" (chỉ BOD, Cài đặt > Nhắc deadline) để đổi cách nhận, gỡ thiết bị của người khác (`goThietBi`, `maMay_`) và gửi thử (`guiThuThongBao`).
- App (Web Push chuẩn, không qua dịch vụ ngoài): máy chủ tự tạo cặp khoá VAPID P-256 lần đầu (Script Properties `VapidRieng`), ký JWT ES256 bằng code thuần (`kyP256_` trong `Logic.gs`, k theo RFC 6979) rồi gửi một yêu cầu không có nội dung tới địa chỉ đẩy tin của trình duyệt (chỉ chấp nhận máy chủ của Google, Apple, Mozilla, Microsoft). Service worker của trang vỏ nhận tin, hỏi `exec?tb=<mã máy>` để lấy nội dung rồi hiện thông báo. Địa chỉ báo 404/410 (máy đã gỡ app) thì xoá khỏi ThietBi.
- Bật app trên máy: ECODesk nhờ trang vỏ (`bat-thong-bao`) xin quyền và đăng ký, trang vỏ trả `dang-ky-thong-bao` để lưu vào ThietBi. iPhone cần iOS 16.4 trở lên và phải mở app từ màn hình chính.

### Nhắc việc qua Zalo (`src/Zalo.gs`)

- Gọi Zalo Bot API `https://bot-api.zapps.me/bot<mã bot>/<phương thức>` (`getMe`, `getUpdates`, `sendMessage`). Tin dài hơn 2000 ký tự được chia nhỏ.
- Kết nối: mỗi tài khoản ECODesk có một mã 6 ký tự. Họ nhắn mã đó cho bot; ECODesk đọc tin mới bằng `getUpdates` (khi bấm Kiểm tra, và trước mỗi lần nhắc) rồi lưu ID Zalo.
- Giờ nhắc nằm cùng chỗ với số ngày sắp đến hạn (Cài đặt > Lịch nhắc deadline, `luuNhacViec`). Có thể chọn nhiều giờ (tối đa 6, CaiDat `ZaloGioNhac` dạng "8, 20"); mỗi giờ là một lịch chạy hằng ngày (`nhacViecHangNgay`); lịch chạy cả khi chưa có bot Zalo (gửi theo mail, app). BOD nhận task của chính mình; ban nhân sự nhận task của thành viên không phải BOD để nhắc lại qua Messenger; UCV không nhận nhắc việc.
- Đổi sang mã bot mới thì mọi kết nối cũ bị xoá, mọi người nhắn mã lại cho bot mới.
- Khi BOD được giao task mới, người đó được báo ngay theo các cách đã chọn.

### Mail (`src/Mail.gs`)

- Mọi thư gửi bằng Gmail của tài khoản chủ file dữ liệu (tài khoản CLB). Tên người gửi hiển thị đặt trong Cài đặt.
- UCV đọc hộp thư tự do (theo thư mục, nhãn, tìm kiếm). BOD chọn cho UCV xem toàn bộ hộp thư hay chỉ các luồng thư do chính UCV đó gửi (CaiDat `UcvXemHopThu`).
- Mọi thao tác thay đổi hộp thư của UCV (soạn, trả lời, trả lời tất cả, chuyển tiếp, lưu trữ, về hộp thư đến, xoá, báo thư rác, gắn và bỏ nhãn) thành một dòng ViecMail. BOD chọn Đã duyệt (thực hiện ngay trên Gmail), Cần sửa lại, hoặc Từ chối, kèm ghi chú.
- Tệp UCV đính kèm được lưu ở thư mục Drive "ECO - Đính kèm mail" (tự tạo; mã thư mục ở CaiDat `ThuMucDinhKemId`).
- Nội dung thư đến hiển thị trong khung riêng không chạy được mã (sandbox), nên thư lạ không ảnh hưởng ECODesk.
- BOD không viết thư trong app. Thư mẫu là thư nháp trong Gmail của CLB; app liệt kê, xem trước và mở thẳng thư nháp trong Gmail. Có nút mở Gmail CLB.
- UCV viết thư trong app (khung soạn có định dạng, đính kèm, trích dẫn thư cũ, chữ ký CLB) rồi gửi BOD duyệt. Chữ ký lấy từ chữ ký mặc định trong Gmail của CLB (Gmail API `settings/sendAs` gọi bằng quyền Gmail sẵn có, nên không cần xin thêm quyền; nhớ 6 giờ); Cài đặt chỉ bật hay tắt (CaiDat `DungChuKy`). Tên người gửi là tên tài khoản Google CLB.
- Gửi hàng loạt: chọn một thư nháp Gmail (giữ nguyên định dạng, ảnh trong thư và tệp đính kèm), người nhận (thành viên, danh bạ, nhập tay, hoặc Google Sheet), xem trước rồi gửi ngay hoặc hẹn giờ. `{TenCot}` được thay bằng thông tin người nhận, so khớp tên cột không phân biệt dấu, hoa thường, khoảng trắng; thiếu cột thì không cho gửi. Kiểm tra số thư còn gửi được trong ngày trước khi gửi.
- Thư hẹn giờ: lịch chạy `guiThuDaLenLich` mỗi 10 phút (tự cài lần đầu hẹn giờ) gửi các thư đã đến giờ.

### Báo cáo (`src/BaoCao.gs`)

- Chọn khoảng thời gian: tháng, học kỳ, nhiệm kỳ (lấy từ tab KyHoatDong: một học kỳ kéo dài đến ngày trước học kỳ sau), hoặc tự chọn.
- Xem theo thành viên, theo ban (PR CAP, PR DES… gộp thành PR), hoặc cả CLB. Chỉ tính người đang có trong danh sách thành viên; người đã rời CLB không còn trong báo cáo nhưng lịch sử vẫn nằm trong sheet.
- Chỉ tính thành viên, không tính BOD. Chỉ số: điểm; số lần mỗi loại hoạt động; task đã xong (theo ngày xong); task trễ hạn (hạn chót nằm trong khoảng, xong sau hạn hoặc chưa xong mà đã quá hạn).
- Biểu đồ chia mốc theo ngày (khoảng ≤ 31 ngày), theo tuần (≤ 120 ngày), hoặc theo tháng.
- Xuất Excel: tạo Google Sheet tạm, tải về dạng .xlsx rồi chuyển sheet tạm vào thùng rác.

### File đăng ký log

- Cài đặt có link Google Sheet mẫu (`LinkMauLog`) và thư mục Drive để lưu (`LinkThuMucLog`).
- Tạo file từ mẫu của tool cũ (có tab "Đăng ký log"): làm giống hệt tool cũ. Người được chọn xếp theo ban, từ dòng 5 ghi Họ tên, Lớp, Ban, SĐT (cột A–D); mỗi buổi một cột ô tích từ cột E (chép định dạng cột E), tên buổi ở dòng 4 (nền lấy từ ô Ghi chú F4), dòng 3 đếm số người tích; cột Ghi chú ở cuối; cột Ban gộp ô theo ban và xoay chữ; kẻ khung; khoá tab, chỉ chừa ô tích và Ghi chú. Tab "Kế hoạch" (nếu có) thêm cột buổi, dòng 3 lấy số đếm từ tab Đăng ký log. Tên file giữ đúng như người tạo gõ.
- Tạo file từ mẫu khác: chép mẫu vào thư mục, tìm dòng tiêu đề có cột Họ và tên (và STT, Ban, Số điện thoại nếu có), điền những người được chọn, thêm mỗi buổi một cột ô đánh dấu ngay sau cột tiêu đề cuối. Chưa có file mẫu thì không cho tạo.

### Cài đặt

| Mục | Lưu ở |
|---|---|
| Loại hoạt động và điểm | tab LoaiHoatDong; cột `CongTay` = `khong` nghĩa là chỉ hiện trên ECOBoard (cộng tự động), BOD không chọn được khi cộng điểm |
| Quy chế cộng điểm (link file Docs) | CaiDat, khoá `QuyChe` |
| Báo BOD khi có góp ý mới | CaiDat, khoá `BaoGopYQuaMail` (`tat` là tắt) |
| Báo BOD khi UCV gửi thư chờ duyệt | CaiDat, khoá `BaoThuChoDuyet` (`tat` là tắt) |
| Ảnh nền trang đăng nhập | CaiDat, khoá `AnhNenId` (file JPEG trong thư mục Drive `ThuMucAnhNenId`), `AnhNenPhienBan` (máy chỉ tải lại ảnh khi số này đổi) |
| Có thêm chữ ký Gmail vào thư UCV | CaiDat, khoá `DungChuKy` |
| Client ID đăng nhập Google | CaiDat, khoá `GoogleClientId` |
| Bảng ghim | tab BangGhim |
| Số ngày coi là sắp đến hạn | CaiDat, khoá `SapDenHanNgay` (mặc định 2) |
| Bot Zalo | CaiDat, khoá `ZaloToken`, `ZaloTenBot`, `ZaloGioNhac`, `ZaloNhacSapDenHan`, `ZaloNhacTre`, `ZaloLanNhacCuoi`; người nhận ở tab KetNoiZalo |
| Ban nhân sự, UCV, mật khẩu | tab TaiKhoan |
| Quyền xem hộp thư của UCV | CaiDat, khoá `UcvXemHopThu` |
| Ai nhận thông báo bằng cách nào | tab TaiKhoan, cột `NhanThongBao` (sửa ở trang Thông báo) |
| Danh bạ gửi hàng loạt | tab DanhBa; thành viên CLB có email luôn có sẵn (`danhBaThanhVien_`), không cần nhập |
| Sheet mẫu và thư mục file đăng ký log | CaiDat, khoá `LinkMauLog`, `LinkThuMucLog` |

## Trang vỏ (`pwa/`) và đăng nhập Google

- `pwa/board/` và `pwa/desk/` là hai trang có manifest riêng nên cài được thành hai app. Mỗi trang mở ứng dụng web Apps Script toàn màn hình trong một khung (iframe); link ứng dụng web ở `pwa/config.js`.
- `pwa/sw.js` giữ sẵn file của trang vỏ (cần cho việc cài app); dữ liệu luôn lấy trực tiếp từ Apps Script.
- Trang vỏ được đưa lên GitHub Pages từ nhánh `gh-pages` (bản sao của thư mục `pwa/`).
- Đăng nhập Google: ECODesk (trong khung) chào trang vỏ bằng `postMessage`; nếu CLB đã nhập Client ID (CaiDat `GoogleClientId`), màn hình đăng nhập có nút Google. Bấm nút thì trang vỏ hiện nút đăng nhập chính thức của Google, nhận mã xác nhận (ID token) rồi gửi vào ECODesk. Máy chủ hỏi lại Google (`oauth2.googleapis.com/tokeninfo`), kiểm tra đúng Client ID, email đã xác minh, còn hạn, rồi tìm tài khoản theo email và tạo phiên như đăng nhập mật khẩu.
- Ghi nhớ đăng nhập: phiên ECODesk có hạn 60 ngày và tự gia hạn mỗi lần mở. Phiên lưu cả trong khung lẫn ở trang vỏ (`eco_desk_phien`), vì điện thoại hay xoá bộ nhớ của khung bên trong; trang vỏ gửi lại phiên khi app mở.
- Khoảng an toàn (tai thỏ, thanh điều hướng): trang vỏ đo bằng `env(safe-area-inset-*)` rồi gửi vào app (`vien`). App trả lời `ho-tro-vien` thì trang vỏ cho khung tràn toàn màn hình; app cũ không trả lời thì khung vẫn chừa phần trên như trước. App gửi `mau` (màu thanh tiêu đề và thanh tab) để trang vỏ tô phần tai thỏ và thanh vuốt cùng màu. Trên iPhone (app ở màn hình chính) khung được kéo cao bằng màn hình nếu trình duyệt báo thiếu.
- Icon: `tab-*.png` tách nền cho tab trình duyệt (cả trang Apps Script qua `setFaviconUrl`); `apple-*.png` vuông nền trắng cho iPhone (máy tự bo góc); `*-192/512.png` vuông nền trắng cho Android (máy tự cắt theo hình của máy); `badge-96.png` hình trắng cho thanh trạng thái Android. Trong app, logo hiện trong khung tròn.
- Trang vỏ chỉ trao đổi với trang thuộc `script.google.com` hoặc `*.googleusercontent.com`.

## Trang chủ và màn chờ (`src/DungChung.html`, dùng cho cả ECOBoard và ECODesk)

- Mở app là vào Trang chủ: khung chào có bầu trời đổi theo buổi (sáng, trưa, chiều, tối, khuya) và một câu hỏi thăm ngẫu nhiên (danh sách `CAU_HOI`, sửa thoải mái). ECODesk thêm các ô tóm tắt theo vai trò (`layTrangChu`); ECOBoard thêm 5 người dẫn đầu.
- Màn chờ dùng chung `cho()`: lá bị gió thổi bay kèm câu đùa (`CAU_CHO`).
- ECOBoard luôn dùng giao diện sáng và không hiện BOD (BOD không tham gia cộng điểm).
- Màn đăng nhập và màn chờ có nền xanh đậm; `apGiaoDien` báo trang vỏ tô phần dưới màn hình cùng màu để không lộ vệt trắng.

## Giao diện ECODesk

- Lưới ô (thống kê, loại hoạt động, ô tóm tắt, ô điều hướng, hàng ô nhập) chia đều bằng `chiaDeu` trong `DeskChung.html`: ít hàng nhất, số ô mỗi hàng chênh tối đa 1, ô giãn cho đầy hàng. Bề rộng tối thiểu mỗi ô là biến CSS `--o`, số cột tối đa là `--toida` (điện thoại tối đa 2).
- Thẻ người dùng: BOD hiện chức vụ lấy từ cột ChucVu của danh sách thành viên (`chucVuCua_`), vai trò khác hiện BOD/HR/UCV.
- Cài đặt nhớ vị trí cuộn và nội dung ô tìm khi mở một mục rồi quay lại (`CUON_CAI_DAT`).
