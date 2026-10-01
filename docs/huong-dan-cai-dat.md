# Hướng dẫn cài đặt lên tài khoản Google của CLB

Làm một lần duy nhất, khoảng 15 phút. Đăng nhập **tài khoản Google của CLB** trước khi bắt đầu.

## 1. Tạo file dữ liệu

1. Vào Google Drive, tạo một Google Sheet mới, đặt tên **ECO - Dữ liệu**.
2. Trong file đó, bấm **Tiện ích mở rộng → Apps Script**. Một tab mới mở ra.

## 2. Đưa mã vào Apps Script

### Cách tự động (khuyên dùng)

Cài một lần, sau đó mỗi khi gộp thay đổi vào nhánh `main` trên GitHub, GitHub tự đẩy mã lên Apps Script và cập nhật app (link giữ nguyên).

1. Đăng nhập tài khoản CLB, mở https://script.google.com/home/usersettings và bật **Google Apps Script API**.
2. Trên một máy tính có cài Node.js, mở cửa sổ lệnh (Terminal trong VS Code) và chạy `npx @google/clasp login`. Trình duyệt mở ra: chọn **tài khoản CLB**, bấm **Cho phép**.
3. Mở file `.clasprc.json` vừa được tạo trong thư mục người dùng (Windows: `C:\Users\<tên máy>\.clasprc.json`, Mac: `~/.clasprc.json`) và sao chép toàn bộ nội dung.
4. Trên GitHub, vào kho mã → **Settings → Secrets and variables → Actions → New repository secret**, tạo:
   - `CLASPRC_JSON`: dán nội dung vừa sao chép.
   - `SCRIPT_ID`: trong Apps Script bấm **Cài đặt dự án** (bánh răng), sao chép **ID tập lệnh**.
5. Xoá file `.clasprc.json` trên máy cho an toàn.
6. Vào tab **Actions** của kho mã → **Đẩy code lên Google Apps Script** → **Run workflow**. Đợi dấu tích xanh, rồi tải lại Apps Script sẽ thấy đủ các file.
7. Sau bước 4 bên dưới (triển khai lần đầu), vào **Triển khai → Quản lý các lần triển khai**, sao chép **Mã triển khai** và tạo thêm secret `DEPLOYMENT_ID`. Từ đó mỗi lần gộp thay đổi, app tự cập nhật.

Lưu ý: Apps Script giữ tối đa 200 phiên bản. Nếu GitHub báo lỗi đã đủ phiên bản, vào Apps Script → **Phiên bản** (biểu tượng đồng hồ) xoá bớt các phiên bản cũ. Nếu đăng nhập hết hạn (lâu không dùng), làm lại bước 2 đến 4 cho `CLASPRC_JSON`. App đang chạy không bị ảnh hưởng.

### Cách thủ công

Trên GitHub, mở từng file trong thư mục `src/`, bấm nút **Copy raw file** (biểu tượng hai tờ giấy ở góc phải) rồi dán vào Apps Script:

| File trên GitHub | Trong Apps Script |
|---|---|
| `src/Code.gs` | Dán đè vào file `Mã.gs` có sẵn (hoặc `Code.gs`) |
| `src/Logic.gs` | Bấm **+ → Tập lệnh**, đặt tên `Logic` |
| `src/Board.html` | Bấm **+ → HTML**, đặt tên `Board` |
| `src/HauKy.html` | Bấm **+ → HTML**, đặt tên `HauKy` |
| `src/MayChuDesk.gs` | Bấm **+ → Tập lệnh**, đặt tên `MayChuDesk` (không đặt `Desk` vì Apps Script không cho trùng tên với `Desk.html`) |
| `src/Desk.html` | Bấm **+ → HTML**, đặt tên `Desk` |
| `src/Zalo.gs` | Bấm **+ → Tập lệnh**, đặt tên `Zalo` |
| `src/Mail.gs` | Bấm **+ → Tập lệnh**, đặt tên `Mail` |
| `src/BaoCao.gs` | Bấm **+ → Tập lệnh**, đặt tên `BaoCao` |
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
5. Link ECODesk là link đó thêm `?app=desk` ở cuối, ví dụ `https://script.google.com/macros/s/…/exec?app=desk`. Ban điều hành đăng nhập bằng email trong danh sách thành viên và mật khẩu mặc định đã nhập ở bước 3.

## Khi có mã mới

Nếu đã cài cách tự động ở bước 2, chỉ cần gộp thay đổi vào `main`. Nếu không, chép lại các file đã thay đổi như bước 2, lưu, rồi vào **Triển khai → Quản lý các lần triển khai → biểu tượng bút chì → Phiên bản: Phiên bản mới → Triển khai**. Link ECOBoard giữ nguyên.

Nếu bản mới cần thêm quyền (ví dụ bản có bot Zalo cần quyền gửi yêu cầu ra ngoài và chạy theo lịch, bản có Mail cần quyền đọc và gửi Gmail, lưu tệp vào Drive), hãy cấp lại quyền một lần: trong Apps Script chọn hàm `khoiTaoCoSoDuLieu` ở thanh trên cùng, bấm **Chạy**, rồi **Cho phép** như bước 3.

## Bật nhắc việc qua Zalo

Head HR làm mỗi năm một lần, chi tiết có ngay trong ECODesk: **Cài đặt → Bot Zalo nhắc việc → Hướng dẫn tạo bot Zalo**. Tóm tắt: tạo bot ở bot.zaloplatforms.com, dán mã bot vào ECODesk, chọn giờ nhắc, bấm Lưu; rồi mỗi BOD và thành viên ban nhân sự nhắn mã kết nối của mình cho bot.

## Bật đăng nhập bằng Google cho ECODesk

Làm một lần, khoảng 5 phút, bằng **tài khoản Google của CLB**. Hướng dẫn từng bước có ngay trong ECODesk: **Cài đặt → Đăng nhập Google**. Tóm tắt:

1. Mở https://console.cloud.google.com, tạo một dự án (ví dụ "ECODesk").
2. Vào **APIs & Services → OAuth consent screen**, chọn **External**, điền tên app và email CLB, lưu rồi bấm **Publish app**.
3. Vào **Credentials → Create credentials → OAuth client ID**, loại **Web application**. Ở **Authorized JavaScript origins** thêm `https://ecotdn.github.io`. Bấm **Create**.
4. Sao chép **Client ID** (đuôi `.apps.googleusercontent.com`), dán vào ECODesk ở **Cài đặt → Đăng nhập Google**, bấm Lưu.

Nút Google chỉ hiện khi mở ECODesk từ app cài trên máy (link ecotdn.github.io/desk/). Người đăng nhập phải dùng đúng email đã có tài khoản trong ECODesk.
