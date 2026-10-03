function createLogFromTemplate() {
  var ui = SpreadsheetApp.getUi();
  
  // ID File Mẫu chuẩn
  var TEMPLATE_ID = "1nOPtLkOKEm9V2EJTq4W12RqTcfE8c9Zb7BU13TwAw5U"; 
  // ID Folder đích lưu file sau khi tạo xong
  var DEST_FOLDER_ID = "1ZlROCntaqcOcaS-M19E_EU5_GibryFSO";
  
  // 1. Hỏi Tên đợt Log
  var nameResponse = ui.prompt(
    'Bước 1: tên đợt làm log',
    'Nhập tên đợt làm log (Ví dụ: ODAY):',
    ui.ButtonSet.OK_CANCEL
  );
  if (nameResponse.getSelectedButton() !== ui.Button.OK) return;
  var eventName = nameResponse.getResponseText().trim();
  if (!eventName) {
    ui.alert('Tên đợt làm log không được để trống!');
    return;
  }
  
  // 2. Hỏi danh sách các Buổi làm log (Phân cách bằng dấu phẩy ",")
  var shiftResponse = ui.prompt(
    'Bước 2: cấu hình buổi làm log',
    'Nhập tên các buổi làm log (phân cách bằng dấu phẩy ",")',
    ui.ButtonSet.OK_CANCEL
  );
  if (shiftResponse.getSelectedButton() !== ui.Button.OK) return;
  var shiftText = shiftResponse.getResponseText().trim();
  if (!shiftText) {
    ui.alert('Danh sách buổi làm log không được để trống!');
    return;
  }
  
  var shifts = shiftText.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  var numShifts = shifts.length;
  
  var ssTitle = "[ECO] ĐĂNG KÝ LÀM LOG " + eventName.toUpperCase() + " 2627";
  
  // 3. Nhân bản File Mẫu chuẩn TRỰC TIẾP VÀO FOLDER ĐÍCH
  var templateFile = DriveApp.getFileById(TEMPLATE_ID);
  var destFolder = DriveApp.getFolderById(DEST_FOLDER_ID);
  var newFile = templateFile.makeCopy(ssTitle, destFolder);
  var newSs = SpreadsheetApp.open(newFile);
  
  // 4. Đọc dữ liệu từ tab "Thành viên" ở Sheet nguồn
  var sourceSs = SpreadsheetApp.getActiveSpreadsheet();
  var memberSheet = sourceSs.getSheetByName("Thành viên");
  if (!memberSheet) {
    ui.alert('Không tìm thấy tab "Thành viên" trong file này!');
    return;
  }
  
  var memberData = memberSheet.getDataRange().getValues();
  if (memberData.length < 2) {
    ui.alert('Tab "Thành viên" chưa có dữ liệu!');
    return;
  }
  
  var members = [];
  for (var i = 1; i < memberData.length; i++) {
    var name = String(memberData[i][0]).trim();
    if (!name) continue;
    members.push({
      name: name,
      lop: String(memberData[i][1]).trim(),
      ban: String(memberData[i][2]).trim(),
      sdt: String(memberData[i][4]).trim()
    });
  }
  
  members.sort(function(a, b) {
    return a.ban.localeCompare(b.ban);
  });
  
  // ==========================================
  // XỬ LÝ TAB 1: ĐĂNG KÝ LOG
  // ==========================================
  var sheet1 = newSs.getSheetByName("Đăng ký log");
  
  // Lấy chính xác MÀU NỀN của ô "Ghi chú" (Ô F4) trong file mẫu chuẩn
  var ghiChuBg = sheet1.getRange("F4").getBackground();
  
  // Tạo thêm cột nếu số buổi làm log > 1 (Copy nguyên định dạng từ cột E)
  if (numShifts > 1) {
    sheet1.insertColumnsAfter(5, numShifts - 1);
    var sourceCol1 = sheet1.getRange(1, 5, sheet1.getMaxRows(), 1);
    for (var k = 1; k < numShifts; k++) {
      sourceCol1.copyTo(sheet1.getRange(1, 5 + k, sheet1.getMaxRows(), 1));
    }
  }
  
  var totalColsTab1 = 4 + numShifts + 1; // Col A,B,C,D + Các buổi + Ghi chú
  var lastMemberRow = 4 + members.length;
  
  // Điền danh sách Thành viên (Hàng 5 trở đi)
  if (members.length > 0) {
    var dataRows = members.map(function(m) {
      return [m.name, m.lop, m.ban, "'" + m.sdt];
    });
    
    // Ghi dữ liệu Họ tên, Lớp, Ban, SĐT
    sheet1.getRange(5, 1, members.length, 4).setValues(dataRows);
    sheet1.getRange(5, 1, members.length, 1).setHorizontalAlignment("left");
    sheet1.getRange(5, 2, members.length, 3).setHorizontalAlignment("center");
    
    // Thêm Checkbox cho các cột Buổi làm log
    sheet1.getRange(5, 5, members.length, numShifts).insertCheckboxes().setHorizontalAlignment("center");

    // Gộp ô cột Ban (Cột C) theo Ban giống nhau & Xoay chữ 90 độ
    var startRow = 5;
    for (var r = 0; r < members.length; r++) {
      if (r === members.length - 1 || members[r].ban !== members[r + 1].ban) {
        var numRows = r + 5 - startRow + 1;
        var banRange = sheet1.getRange(startRow, 3, numRows, 1);
        if (numRows > 1) {
          banRange.merge();
        }
        banRange.setTextRotation(90)
                .setVerticalAlignment("middle")
                .setHorizontalAlignment("center");
        startRow = r + 6;
      }
    }
  }
  
  // Điền Tên các buổi làm log ở Hàng 4 (Nền lấy từ ô Ghi chú, CHỮ MÀU ĐEN)
  sheet1.getRange(4, 5, 1, numShifts).setValues([shifts])
    .setBackground(ghiChuBg).setFontColor("#000000").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet1.getRange(4, totalColsTab1).setValue("Ghi chú")
    .setBackground(ghiChuBg).setFontColor("#000000").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
    
  // Điền Công thức COUNTIF ở Hàng 3 (Nền trắng, chữ KHÔNG in đậm)
  for (var c = 0; c < numShifts; c++) {
    var colLetter = getColumnLetter(5 + c);
    var countifFormula = "=COUNTIF(" + colLetter + "5:" + colLetter + (lastMemberRow > 4 ? lastMemberRow : 5) + ", TRUE)";
    sheet1.getRange(3, 5 + c)
      .setFormula(countifFormula)
      .setBackground("#ffffff")
      .setFontWeight("normal")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  }
  
  // Thực hiện Gộp ô (Merge) Tab 1
  sheet1.getRange(1, 1, 1, totalColsTab1).merge(); // Hàng 1
  sheet1.getRange(2, 1, 1, totalColsTab1).merge(); // Hàng 2
  sheet1.getRange(3, 1, 2, 1).merge(); // Ô A3 gộp A4
  sheet1.getRange(3, 2, 2, 1).merge(); // Ô B3 gộp B4
  sheet1.getRange(3, 3, 2, 1).merge(); // Ô C3 gộp C4
  sheet1.getRange(3, 4, 2, 1).merge(); // Ô D3 gộp D4
  sheet1.getRange(3, totalColsTab1, 2, 1).merge(); // 2 ô 3,4 của cột Ghi chú
  
  // Kẻ khung viền bảng Tab 1
  sheet1.getRange(3, 1, members.length + 2, totalColsTab1)
    .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  // Bảo vệ Sheet Tab 1 (Chỉ cho phép sửa vùng Checkbox và Cột Ghi chú)
  var protection1 = sheet1.protect().setDescription('Khóa chỉnh sửa Tab Đăng ký log');
  var unprotectedRanges1 = [];
  if (members.length > 0) {
    unprotectedRanges1.push(sheet1.getRange(5, 5, members.length, numShifts)); // Vùng checkbox
    unprotectedRanges1.push(sheet1.getRange(5, totalColsTab1, members.length, 1)); // Vùng ghi chú
  }
  protection1.setUnprotectedRanges(unprotectedRanges1);

  // ==========================================
  // XỬ LÝ TAB 2: KẾ HOẠCH
  // ==========================================
  var sheet2 = newSs.getSheetByName("Kế hoạch");
  
  // Tạo thêm cột nếu số buổi làm log > 1
  if (numShifts > 1) {
    sheet2.insertColumnsAfter(2, numShifts - 1);
    var sourceCol2 = sheet2.getRange(1, 2, sheet2.getMaxRows(), 1);
    for (var m = 1; m < numShifts; m++) {
      sourceCol2.copyTo(sheet2.getRange(1, 2 + m, sheet2.getMaxRows(), 1));
    }
  }
  
  var totalColsTab2 = 1 + numShifts; // Col A + Các buổi
  
  // Điền Công thức đồng bộ Hàng 3 (Nền trắng, KHÔNG in đậm) & Tên buổi Hàng 4 (Nền lấy từ Ghi chú, CHỮ MÀU ĐEN)
  for (var s2 = 0; s2 < numShifts; s2++) {
    var tab1ColLetter = getColumnLetter(5 + s2);
    sheet2.getRange(3, 2 + s2)
      .setFormula("='Đăng ký log'!" + tab1ColLetter + "3")
      .setBackground("#ffffff")
      .setFontWeight("normal")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
      
    sheet2.getRange(4, 2 + s2).setValue(shifts[s2])
      .setBackground(ghiChuBg).setFontColor("#000000").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  }
  
  // Thực hiện Gộp ô (Merge) Tab 2
  sheet2.getRange(1, 1, 1, totalColsTab2).merge(); // Hàng 1
  sheet2.getRange(2, 1, 1, totalColsTab2).merge(); // Hàng 2
  sheet2.getRange(3, 1, 2, 1).merge(); // Ô A3 gộp A4
  
  // Kẻ khung viền Tab 2
  sheet2.getRange(3, 1, 5, totalColsTab2)
    .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

  // Thông báo hoàn tất
  ui.alert(
    'Tạo file thành công!',
    'Đã tạo thành công file Google Sheet mới tại folder chỉ định:\n' + ssTitle + '\n\nLink truy cập file mới:\n' + newSs.getUrl(),
    ui.ButtonSet.OK
  );
}

// Hàm phụ trợ đổi số thứ tự cột thành Chữ (VD: 5 -> E, 6 -> F)
function getColumnLetter(colIndex) {
  var temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
}