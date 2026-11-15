# PharmaSee — Plan xây dựng backend (dựa trên SYSTEM_DESIGN.md)

## Context

`SYSTEM_DESIGN.md` đã chốt kiến trúc nhắc uống thuốc qua FaceTime: scheduler → Supabase → Chert outbound call → LiveKit → `my-agent` (Gemini realtime voice) → xác minh thuốc → ghi `dose_logs`. Plan này biến thiết kế đó thành code cụ thể: module nào, thư viện nào, nối với nhau ra sao, build theo thứ tự nào để test được từng bước.

Quyết định bổ sung vừa chốt:
- **Outbound chỉ có audio** (Chert trả `outbound_video_disabled`) → cuộc gọi theo lịch xác minh thuốc bằng **giọng nói** (bệnh nhân đọc to tên trên nhãn). Pipeline camera OCR vẫn xây, tự bật khi cuộc gọi có video (inbound, hoặc khi Chert mở outbound video).
- **Agent nói tiếng Anh.**
- **Có xử lý inbound**: cuộc gọi không có metadata lịch → agent tra các liều hôm nay còn `pending/missed_no_answer/unconfirmed` và chạy cùng luồng. Đây cũng là đường duy nhất có video để test camera OCR.

Hiện trạng đã kiểm chứng: `my-agent` chỉ có 3 dependency (`@livekit/agents`, `@livekit/agents-plugin-google`, `@livekit/rtc-node`); `call-me.mjs` đang import `livekit-server-sdk` nhờ cài gián tiếp (transitive); `@google/genai@2.32.0` có sẵn gián tiếp; chưa có Supabase/cron; `.env.local` chưa có biến `SUPABASE_*`.

## Cấu trúc code (tất cả trong `my-agent/`, giữ 1 package)

```
my-agent/
  agent.mjs            (SỬA) entry: đọc metadata → nạp liều → dựng instructions + tools
  scheduler.mjs        (MỚI) node-cron mỗi phút: tạo dose_logs, gọi, retry, fallback
  call-me.mjs          (SỬA) CLI mỏng gọi lib/outbound.mjs (giữ để test tay)
  seed.mjs             (MỚI) tạo auth user + users + user_medications mẫu
  lib/db.mjs           (MỚI) Supabase client + query helpers
  lib/chert.mjs        (MỚI) Chert HTTP API: lines, calls, getCall, sendMessage
  lib/outbound.mjs     (MỚI) room + dispatch(metadata) + token + placeCall
  lib/dose-session.mjs (MỚI) instructions tiếng Anh + function tools cho agent
  lib/vision.mjs       (MỚI) bắt frame video người gọi → JPEG → Gemini OCR
  supabase/001_pharmasee.sql (MỚI) migration chạy tay trong Supabase SQL editor
```
Giữ nguyên: `chert-rooms.mjs`, `face.mjs`, `greet.mjs` (tái sử dụng như hiện tại).

## Thư viện

Thêm vào `package.json` `dependencies`:
- `@supabase/supabase-js` — client DB (dùng service role key ở backend)
- `node-cron` — scheduler mỗi phút
- `@google/genai` — gọi Gemini `generateContent` (vision OCR, ngoài kênh realtime; plugin Node có `pushVideo()` rỗng)
- `livekit-server-sdk` — đưa thành dependency trực tiếp (đang dùng nhưng chỉ có gián tiếp)
- `jpeg-js` — encode frame RGBA → JPEG thuần JS (không cần native như `sharp`)
- `zod` — schema tham số cho function tools của `@livekit/agents` (kiểm tra version khớp cái agents đang dùng bằng `npm ls zod`)

Thêm script: `"scheduler": "node --env-file=.env.local scheduler.mjs"`, `"seed": "node --env-file=.env.local seed.mjs"`.

Biến môi trường mới trong `.env.local`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_ID` (bệnh nhân duy nhất, dùng cho inbound; seed in ra giá trị).

## Database — việc người dùng tự chạy (`supabase/001_pharmasee.sql`)

```sql
alter table users add column phone text;               -- E.164, phải là số đã verify với Chert
create unique index dose_logs_med_time on dose_logs(medication_id, scheduled_at); -- chống tạo trùng
```
Lưu ý: `users.id` FK tới `auth.users.id` → `seed.mjs` phải tạo auth user trước bằng `supabase.auth.admin.createUser()` rồi mới insert `users`. `status` dùng các giá trị: `pending`, `calling`, `confirmed`, `unconfirmed`, `missed_no_answer`, `wrong_medication_flagged`.

## Các module và cách nối

### `lib/db.mjs`
- `getDueMedications(now)`: lấy `user_medications` active (`start_date <= hôm nay`, `end_date` null hoặc `>=` hôm nay) join `users(id, name, phone, timezone)`; lọc ở JS những thuốc có `reminder_times` khớp HH:MM hiện tại theo `users.timezone` (dùng `Intl.DateTimeFormat`).
- `createDoseLogs(rows)`: upsert `dose_logs` (`onConflict: medication_id,scheduled_at`, `ignoreDuplicates`) → trả về các bản ghi mới tạo.
- `getDoseContext(doseLogIds)`: `dose_logs` join `user_medications(name, dosage)` join `users(name, phone)`.
- `getOpenDosesToday(userId)`: liều hôm nay của user có status `pending|missed_no_answer|unconfirmed`.
- `setDoseStatus(ids, status, { takenAt })`.

### `lib/chert.mjs` (tách từ `call-me.mjs`)
- Headers sẵn có (`Authorization`, `x-chert-project-id`, `Idempotency-Key`). Base `https://app.trychert.com/api/v1` (đã chạy được).
- `getLine()` (đọc `data.items[0]`), `placeCall({...})`, `getCall(id)`, `sendMessage({ lineId, recipient, text })` → `POST /shared-messages` (chưa test, verify ở Phase D).

### `lib/outbound.mjs`
- `startReminderCall({ phone, metadata })`: tạo room `outbound-<ts>`; `AgentDispatchClient.createDispatch(room, AGENT_NAME, { metadata: JSON.stringify(metadata) })`; token `identity: 'chert-bridge', ttl: 3600`; `placeCall` với `media: { audio: true, video: false }`, `destination_type: 'phone'`, `remote_participant_identity: AGENT_NAME` (các tham số đã debug thành công). Trả về `callId`.
- Metadata: `{ userId, doseLogIds: [...] }`. Agent đọc lại qua `ctx.job.metadata` (đã xác nhận là field string trên `proto.Job`, chỉ có ở đường `cli.runApp` — đúng đường mình đang chạy vì có LiveKit keys).

### `scheduler.mjs`
- `cron.schedule('* * * * *', tick)`.
- `tick`: `getDueMedications` → `createDoseLogs` → gom theo `(userId, scheduled_at)` → mỗi nhóm: set `calling`, `startReminderCall`.
- Theo dõi cuộc gọi: poll `getCall(callId)` mỗi ~10s. Kết thúc mà `answered_at` null → hẹn retry sau 2 phút (1 lần). Lần 2 vẫn không bắt máy → `sendMessage` iMessage + `missed_no_answer`.
- **Nội dung iMessage fallback có link gọi lại**: tên thuốc cần uống + `facetime://<số line>` (lấy từ `getLine().phone_number`) và số dạng thường. Bệnh nhân bấm → FaceTime gọi **inbound** vào agent → agent tra liều `missed_no_answer` hôm nay và chạy luồng xác minh, **có video nên dùng được camera OCR**. Liều được gọi lại thành công sẽ chuyển từ `missed_no_answer` sang `confirmed`/`unconfirmed`.
- Không dùng FaceTime Link (link phòng họp): line hiện báo `facetime_link_protocol: 0`, nhiều khả năng chưa hỗ trợ. Cần test ở Phase D xem iMessage có hiển thị `facetime://` thành link bấm được không; nếu không, số điện thoại trơn vẫn được iOS tự nhận diện để gọi.
- Lỗi hạ tầng từ Chert (`line_offline`, `line_in_call`, 5xx) → log riêng `infra_error`, thử lại ở tick sau (không tính là "không bắt máy").
- Kết quả xác nhận/không xác nhận do **agent** ghi, scheduler không ghi đè trạng thái cuối.

### `agent.mjs` + `lib/dose-session.mjs`
- `ctx.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL)` (thay `AUDIO_ONLY`) để nhận video nếu có.
- Nạp liều: có `ctx.job.metadata` → `getDoseContext(doseLogIds)`; không có (inbound) → `getOpenDosesToday(DEMO_USER_ID)`; không còn liều nào → nói chuyện ngắn rồi kết thúc.
- Instructions tiếng Anh dựng động: tên bệnh nhân, danh sách thuốc + dosage; quy trình: chào → với từng thuốc: xác minh (camera nếu có video, không thì đọc to tên) → hướng dẫn liều → hỏi xác nhận đã uống.
- Function tools (Gemini realtime gọi được tool; dùng API tool của `@livekit/agents` với `zod`):
  - `check_medication_on_camera()` → `vision.identifyMedication()`; trả `{ seen, name, confidence }` hoặc `{ video: false }`.
  - `verify_medication_name(spokenName, expectedName)` → so khớp mờ (lowercase, bỏ hàm lượng/ký tự, includes/Levenshtein nhỏ) ở JS, không để LLM tự phán.
  - `flag_wrong_medication(doseLogId, seenName)` → `wrong_medication_flagged`.
  - `confirm_dose_taken(doseLogId)` → `confirmed`, `taken_at = now`.
- Timeout 2 phút từ lúc `bridge_ready`: liều nào chưa có trạng thái cuối → `unconfirmed`, rồi `ctx.shutdown()`.
- Không video → instructions ghi rõ "verify by asking the patient to read the label aloud"; giữ `face.mjs` publish video như cũ.

### `lib/vision.mjs`
- Lấy remote video track của người gọi, `VideoStream` (`@livekit/rtc-node`) đọc 3–5 frame trong ~3 giây, convert RGBA → `jpeg-js` encode.
- `@google/genai`: `models.generateContent({ model: 'gemini-2.5-flash', contents: [ảnh..., prompt] , config: { responseMimeType: 'application/json' } })` — prompt yêu cầu đọc tên thuốc trên nhãn, trả `{ name, confidence }`, nói "unreadable" thay vì đoán.
- Debug: lưu frame mẫu ra `debug-frames/` để đánh giá chất lượng video qua bridge (rủi ro chưa kiểm chứng trong SYSTEM_DESIGN §6).

## Thứ tự build (mỗi phase test được ngay)

1. **Phase A – DB**: thêm deps, chạy SQL migration, `lib/db.mjs`, `seed.mjs` (1 bệnh nhân, phone thật đã verify, 2 thuốc có `reminder_times` = vài phút tới). Test: `npm run seed`, query lại thấy dữ liệu.
2. **Phase B – Outbound có metadata**: `lib/chert.mjs`, `lib/outbound.mjs`, sửa `call-me.mjs`. Test: gọi tay, agent log ra `ctx.job.metadata` đúng.
3. **Phase C – Luồng thuốc bằng giọng nói**: `dose-session.mjs` + sửa `agent.mjs` (tools, timeout, ghi DB). Test: gọi outbound, đọc tên thuốc, xác nhận → `dose_logs.status = confirmed`; thử nói sai tên → `wrong_medication_flagged`; im lặng → `unconfirmed`.
4. **Phase D – Scheduler**: `scheduler.mjs` + retry + iMessage fallback. Test: đặt `reminder_times` 2 phút tới, để tự gọi; lần khác không bắt máy → thấy retry rồi tin iMessage có link + `missed_no_answer`; bấm link gọi lại → agent nhận đúng liều bị lỡ, xác nhận xong status đổi thành `confirmed`.
5. **Phase E – Camera OCR**: `lib/vision.mjs`. Test: bệnh nhân **gọi inbound bằng FaceTime Video**, cầm hộp thuốc; xem frame lưu trong `debug-frames/` và kết quả OCR.

## Chạy hệ thống

- Terminal 1: `npm start` (LiveKit worker, nhận dispatch).
- Terminal 2: `npm run scheduler`.
- Terminal 3: `chert dev --agent my-agent` — cần cho **inbound**. Với outbound qua API có thể không cần (giả định, kiểm chứng ở Phase B).

## Verification

- Mỗi phase có bước test riêng ở trên; kiểm `dose_logs` trực tiếp trên Supabase dashboard sau mỗi cuộc gọi.
- `npm run check` (mở rộng thêm các file mới) để kiểm cú pháp.
- Rủi ro đã biết, không chặn plan: outbound trên line Shared/Trial từng không đổ chuông/kẹt `ending` — nếu Phase B lặp lại, test luồng agent qua inbound (cùng code, thiếu metadata → tra liều hôm nay) trong lúc chờ.
