# PharmaSee — Thiết kế hệ thống nhắc uống thuốc qua FaceTime

> Cập nhật theo hiện trạng code và các lần test ngày 14–15/11/2026. Mỗi khẳng định về chạy được/không chạy được đều ghi rõ đã kiểm chứng bằng cách nào.

## 1. Bối cảnh & mục tiêu

PharmaSee gọi FaceTime tự động để nhắc người già uống thuốc đúng giờ:

0. Chủ động gọi FaceTime đúng thời điểm cần uống thuốc.
1. Nhận diện thuốc đang cầm qua camera.
2. Lấy thông tin đơn thuốc từ database.
3. Hướng dẫn uống thuốc cụ thể (loại nào, bao nhiêu viên).
4. Xác nhận đã uống và cập nhật trạng thái lên database.

**Phạm vi phiên bản này**: demo hackathon, 1 bệnh nhân, chạy local. Dashboard theo dõi/nhập liệu và deploy production là giai đoạn sau.

Xây trên `my-agent` (Node.js, `@livekit/agents` 1.8.0): agent giọng nói + video chạy trên LiveKit, nối FaceTime qua Chert, dùng Gemini Live (`gemini-2.5-flash-native-audio-preview-12-2025`) làm model hội thoại realtime, `gemini-2.5-flash` đọc nhãn thuốc, Supabase làm database.

## 2. Kiến trúc

```
┌─────────────┐ mỗi phút  ┌──────────────────┐
│  scheduler   │ ───────▶ │ Supabase          │ users / user_medications / dose_logs
│ (node-cron)  │ ◀─────── │ (Postgres)        │
└──────┬──────┘  đọc lịch └────────▲─────────┘
       │ tới giờ                     │ ghi trạng thái liều
       │ 1) tạo phòng LiveKit + dispatch agent (metadata: userId, doseLogIds)
       │ 2) POST /api/v1/calls (Chert, audio-only)
       ▼                             │
┌─────────────┐  FaceTime  ┌────────┴──────────────┐
│ Chert        │ ─────────▶ │ my-agent (LiveKit      │ ──▶ Gemini Live (hội thoại + tools)
│ + Mac thật   │ ◀───────── │ worker, agent.mjs)     │ ──▶ Gemini 2.5 Flash (OCR nhãn thuốc)
└─────────────┘  bridge     └───────────────────────┘
```

- **Outbound** (theo lịch): scheduler gọi bệnh nhân. Chert hiện **chỉ cho gọi ra audio** (`outbound_video_disabled`), nên cuộc gọi theo lịch xác minh thuốc bằng **giọng nói**.
- **Inbound** (bệnh nhân tự gọi vào số của line): không có metadata lịch, agent tự tra các liều trong 24 giờ qua còn `pending`/`missed_no_answer`/`unconfirmed`. Gọi bằng FaceTime Video thì có camera để OCR.
- **Test harness** (`test-harness/`): trang web local nối thẳng vào phòng LiveKit bằng micro và webcam, **không qua Chert/FaceTime**, dùng để thử agent khi line Chert hỏng (xem mục 10).

## 3. Cấu trúc code

```
my-agent/
  agent.mjs             entry của agent: nạp liều, tạo phiên Gemini, chào, timeout, phục hồi
  scheduler.mjs         mỗi phút: tạo dose_logs, gọi, thử lại, fallback iMessage
  seed.mjs              tạo bệnh nhân demo + 2 thuốc  (npm run seed -- +1XXXXXXXXXX [phút])
  call-me.mjs           gọi thử tay một cuộc
  lib/db.mjs            Supabase: truy vấn lịch, tạo/cập nhật dose_logs, múi giờ
  lib/chert.mjs         Chert API: lines, calls, end, messages, kiểm tra line sẵn sàng
  lib/outbound.mjs      tạo phòng + dispatch + token + đặt cuộc gọi
  lib/dose-session.mjs  prompt, 4 tools, so khớp tên thuốc
  lib/vision.mjs        lấy frame từ camera bệnh nhân → JPEG → Gemini OCR
  supabase/001_pharmasee.sql, 002_dose_status.sql   chạy tay trong SQL Editor
test-harness/           trang test local (npm start → http://localhost:5174)
```

## 4. Mô hình dữ liệu (Supabase)

Schema gốc: `users`, `user_medications`, `dose_logs` (như thiết kế ban đầu). Cần chạy 2 file SQL:

- **001**: thêm `users.phone` (E.164, phải là số đã verify với Chert) và unique index `dose_logs(medication_id, scheduled_at)` để scheduler không tạo trùng liều.
- **002**: thay `dose_logs_status_check` bằng bộ giá trị: `pending`, `taken`, `missed`, `skipped` (của bạn) cộng `calling`, `unconfirmed`, `missed_no_answer`, `wrong_medication_flagged`.

**Hai ràng buộc có sẵn của bảng, tìm ra khi test** (không thấy trong ảnh schema):
- `dose_logs_status_check`: chỉ cho một danh sách `status`.
- `dose_logs_check`: **`taken_at` chỉ được đặt khi `status = 'taken'`**. Vì vậy liều đã uống được lưu là `taken` (không phải `confirmed`).

| status | ý nghĩa | ai ghi |
|---|---|---|
| `pending` | đã tạo, chờ gọi | scheduler |
| `calling` | đang gọi | scheduler |
| `taken` | bệnh nhân xác nhận đã uống (có `taken_at`) | agent (`confirm_dose_taken`) |
| `wrong_medication_flagged` | thuốc đưa ra không khớp | agent (tự ghi khi xác minh sai) |
| `unconfirmed` | bắt máy nhưng chưa xong (hết 2 phút không tiến triển, hoặc cúp máy giữa chừng) | agent |
| `missed_no_answer` | gọi 2 lần không bắt máy, đã nhắn iMessage | scheduler |

Retry/fallback/xác minh xử lý trong tiến trình lúc gọi; DB chỉ lưu trạng thái cuối. Có thể bổ sung `call_id`, `verification_method` khi làm dashboard.

## 5. Scheduler (`scheduler.mjs`)

- `node-cron` mỗi phút. Với từng thuốc đang hiệu lực có `reminder_times` khớp giờ hiện tại **theo múi giờ của bệnh nhân**, tạo `dose_logs` (`upsert ... ignoreDuplicates`) rồi lấy các liều `pending` trong 15 phút gần nhất.
- Gom các thuốc cùng giờ của cùng bệnh nhân thành **một cuộc gọi**; metadata `{ userId, doseLogIds }` truyền vào agent qua `AgentDispatch` (agent đọc ở `ctx.job.metadata`). Các cuộc gọi chạy tuần tự qua một hàng đợi.
- **Trước khi quay số** kiểm tra line: `availability = available` và phiên Mac `accepting`. Chưa sẵn sàng thì **không gọi**, trả liều về `pending` và kiểm tra lại phút sau (tránh dồn cuộc gọi vào Mac đang hỏng).
- Theo dõi cuộc gọi bằng `GET /calls/{id}` mỗi 5 giây. Không bắt máy trong 75 giây thì **gọi `POST /calls/{id}/end`** để không treo line, đợi 2 phút rồi gọi lại một lần. Vẫn không được thì nhắn iMessage kèm `facetime://<số line>` để bệnh nhân gọi ngược vào, rồi `missed_no_answer`.
- Liều `pending` quá 15 phút (do lỗi hạ tầng liên tục) cũng chuyển sang fallback iMessage.
- Sau cuộc gọi, liều nào agent bỏ dở ở `calling` thì thành `unconfirmed`.

## 6. Luồng một cuộc gọi (`agent.mjs`)

1. Agent vào phòng, đọc metadata, nạp liều (**sắp xếp theo tên thuốc** để thứ tự ổn định). Inbound thì tra các liều còn dở.
2. **Chỉ chào khi cuộc gọi thật sự nối**: khi có tín hiệu `bridge_ready` trong metadata phòng, hoặc 1.5 giây sau khi audio của bệnh nhân xuất hiện (kể cả đã có sẵn). Chào lúc điện thoại còn đang đổ chuông thì bị mất tiếng, đã gặp thật ở cuộc gọi 19:20.
3. Với từng thuốc, theo prompt: nhờ bệnh nhân cầm nhãn sát camera → `check_medication_on_camera` (không có video thì nhờ đọc to) → `verify_spoken_medication_name` → nếu khớp nói đúng liều → hỏi đã uống chưa → `confirm_dose_taken`.
4. **Bốn tools**: `check_medication_on_camera`, `verify_spoken_medication_name`, `flag_wrong_medication`, `confirm_dose_taken`. So khớp tên thực hiện bằng code (bỏ qua hoa thường, hàm lượng, cho phép lệch chính tả nhỏ), không để model tự phán. Khi không khớp, **tool tự ghi `wrong_medication_flagged`**, không phụ thuộc việc model nhớ gọi tool thứ hai.
5. Hết 2 phút không có tiến triển (mỗi lần gọi tool tính là tiến triển), hoặc bệnh nhân cúp máy: liều dở thành `unconfirmed`, agent kết thúc.
6. **Phục hồi**: nếu phiên Gemini chết vì lỗi, plugin không tự thử lại và cuộc gọi sẽ im lặng. Agent mở lại phiên tối đa 2 lần, nói "Sorry about that, I am back" rồi tiếp tục với các thuốc chưa uống; thất bại hẳn thì ghi `unconfirmed`.

**Quy tắc an toàn trong prompt** (tiếng Anh, giọng chậm, câu ngắn): không khuyên liều khác danh sách; bệnh nhân khó chịu/chóng mặt/khó thở thì dừng, báo liên hệ bác sĩ hoặc 911; nói đã uống từ trước thì không bảo uống lại và không ghi xác nhận; từ chối thì không ép.

## 7. Gemini Live: những điều đã học được

- **Phải tắt thinking** (`thinkingConfig: { thinkingBudget: 0 }`). Với thinking mặc định, model phát phần "suy nghĩ" rồi server cắt phiên giữa câu (`1007 The audio content type ... is not supported`), agent im lặng. Tái hiện được bằng bot phát giọng nói vào phòng; tắt thinking thì hết lỗi và trả lời nhanh hơn. Gọi trực tiếp API với cùng cấu hình không lỗi, nên không phải do model hay định dạng audio; nguyên nhân chính xác trong plugin chưa xác định được.
- **Lỗi server thất thường `1011 Internal error occurred`** gặp 2 trên ~8 lần chạy, thường khi hai bên nói chồng nhau. Plugin không thử lại (`retryable: false`), nên cần cơ chế phục hồi ở mục 6.
- Khi tắt thinking, model **bớt tuân thủ việc gọi tool** (từng bỏ qua `flag_wrong_medication`), nên prompt ép gọi tool rõ ràng và việc ghi sai thuốc được chuyển vào code.
- `pushVideo()` của plugin Node là hàm rỗng nên camera không đi qua kênh realtime; ảnh được lấy riêng và gửi `generateContent` (`lib/vision.mjs`).
- Chưa nâng cấp được `@livekit/agents` lên 1.10.0 vì nó đòi `@livekit/rtc-node` 1.x (đổi lớn so với 0.13).

## 8. Nhận diện thuốc qua camera

- **Pipeline**: lấy 4 frame trong ~3 giây từ video của bệnh nhân → JPEG → `gemini-2.5-flash` (JSON `{name, strength, confidence}`, được dặn trả `null` thay vì đoán) → so khớp tên với DB. Frame được lưu ở `my-agent/debug-frames/` để đánh giá chất lượng.
- **Đã kiểm chứng**: bằng webcam qua test harness, OCR đọc ra "Lisinopril" và "Metformin Hydrochloride" từ hộp thuốc thật.
- **Chưa kiểm chứng, và là rủi ro lớn nhất**: chất lượng video **qua FaceTime/Chert**. Chert dùng một Mac thật chạy FaceTime rồi chụp màn hình (`screen_capture_ready` trong trạng thái line), nên hình qua hai lớp nén, chữ nhỏ dễ vỡ. Webcam trực tiếp rõ hơn nhiều, nên kết quả OCR ở harness **lạc quan hơn thực tế**.
- **Lưới an toàn**: nếu OCR không đọc được hoặc không có video, agent nhờ bệnh nhân đọc to tên thuốc. Nên khuyến khích hộp chia thuốc theo ngày in chữ to.

## 9. Độ ổn định của Chert (rủi ro lớn nhất hiện tại)

Dữ kiện thật từ các lần test:

| Lần | Kết quả |
|---|---|
| Demo onboarding (20:59 UTC) | Nối được, 1:35 |
| Inbound video (22:27) | Nối được, 0:59, có audio và video |
| Outbound 22:45 | Kẹt `ending` ~24 phút rồi thành `failed`, không bao giờ đổ chuông |
| Outbound 01:20 | **Nối được** (quay số sau 5s, trả lời sau 15s), 1:39 |
| Outbound 01:25 | Kẹt `ending` hơn 40 phút, Mac `session: offline`, line `busy`, chặn mọi cuộc gọi sau (`line_busy`, `line_in_call`) |

- Lệnh `POST /calls/{id}/end` được Chert nhận (202) nhưng **không gỡ được** cuộc gọi kẹt khi Mac offline; việc dọn do chính Mac làm.
- Quan sát có thể liên quan: cả hai lần kẹt đều xảy ra ngay sau một cuộc gọi khác (17 phút và 3 phút). Mới là giả thuyết, cần hỏi Chert.
- Các ràng buộc API đã gặp: cuộc gọi ra chỉ audio; số nhận phải đã verify (`recipient_not_verified`); token `ttl ≤ 7200s`; `remote_participant_identity` phải khác identity trong token; `destination_type: "phone"` bắt buộc.
- **Khuyến nghị**: line riêng (Dedicated) hoặc nhờ đội Chert xử lý Mac. Với hệ thống nhắc thuốc thật, nên có thêm kênh độc lập với Chert (ví dụ SMS qua Twilio), vì iMessage fallback cũng đi qua cùng Mac.

## 10. Test harness và cách chạy

- **Hệ thống**: `npm start` (agent) và `npm run scheduler` trong `my-agent/`; `chert dev --agent my-agent` chỉ cần cho inbound.
- **Test không cần Chert**: `npm start` trong `test-harness/`, mở `http://localhost:5174`, bấm Start call (đeo tai nghe). Script tạo phòng, dispatch agent, tạo `dose_logs` test ở trạng thái `calling` (scheduler không động tới), hiện trạng thái từng liều theo thời gian thực. Chỉ lắng nghe `127.0.0.1`.
- Kịch bản đã chạy trọn bằng bot giả (giọng Windows): chào → hỏi thuốc → đọc sai (Aspirin) bị phát hiện → đọc đúng → hướng dẫn liều → `taken` có `taken_at`; thuốc thứ hai dở dang → `unconfirmed` sau khi cúp máy.

## 11. Đánh giá khả thi

| Phần | Bằng chứng | Còn thiếu |
|---|---|---|
| Hội thoại Gemini + gọi tool | ✅ Chạy trọn kịch bản nhiều lần (qua LiveKit, không qua Chert) | Giọng người già thật, tiếng ồn, nói chậm; chưa chỉnh độ nhạy ngắt lời (VAD) |
| Ghi trạng thái vào Supabase | ✅ `taken`, `unconfirmed`, `wrong_medication_flagged` | — |
| Scheduler tạo liều, gom thuốc, gọi | ✅ Gọi thật lúc 19:20 | Thử lại và fallback mới chạy được một phần |
| Phục hồi khi Gemini lỗi | ⚠️ Đã viết | Chưa ép được lỗi để thử |
| OCR camera | ✅ Bằng webcam | ❌ Chưa thử qua FaceTime/Chert |
| Outbound FaceTime | ⚠️ Nối được 1/3 lần | Line Trial không ổn định |
| iMessage fallback | ⚠️ Có API | Chưa gửi thử lần nào |
| Nhiều cuộc gọi đồng thời (nhiều bệnh nhân) | Chưa làm | Ngoài phạm vi |

**Kết luận**: phần phần mềm của mình (lịch, hội thoại, xác minh, ghi DB) đã chạy được và kiểm chứng riêng lẻ. Rủi ro còn lại nằm ở **hạ tầng bên ngoài**: độ ổn định của line Chert và chất lượng video qua FaceTime. Cả hai nên được kiểm tra bằng một cuộc gọi FaceTime Video thật khi line phục hồi, trước khi demo.

## 12. Ngoài phạm vi / việc sau

- Dashboard theo dõi và nhập liệu (Supabase có sẵn REST/Realtime).
- Deploy backend (hiện chạy local); nhiều bệnh nhân, xác thực, phân quyền; tích hợp EHR/lịch ngoài.
- Tool riêng cho "đã uống từ trước" và "từ chối uống" để dashboard phân biệt với `unconfirmed`.
- Kênh dự phòng độc lập với Chert; chỉnh VAD cho người nói chậm; đo độ trễ trả lời.
