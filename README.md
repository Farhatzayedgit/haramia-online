# حرامية وأهل قرية — النسخة التانية

لعبة أدوار سرية مصرية من **Movera Productions**: بوتات على موبايل واحد، أو أونلاين من أكتر من موبايل بشات صوتي.

## الملفات

| المكان | فيه إيه |
|---|---|
| `src/engine.js` | قواعد اللعبة كلها (الأدوار، الجولات، التصويت، المهام، المكسب) |
| `src/app.js` | الشاشات، البوتات، الأونلاين على فايربيز، والشات الصوتي |
| `src/template.html` | شكل اللعبة وألوانها |
| `src/cards.json` | رسومات الكروت |
| `src/build.py` | بيجمّع كل ده في `www/index.html` |
| `android/` | مشروع الأندرويد |
| `firebase/database.rules.json` | قواعد الحماية اللي لازم تتحط في فايربيز |
| `.github/workflows/android.yml` | جيت هب بيبني الـAPK لوحده مع كل تعديل |

## إزاي يتبني الـAPK

أي تعديل يترفع على فرع `v2`، جيت هب يبني الأبليكيشن لوحده، ويحط رابط التنزيل في صفحة **Releases** في المستودع.

عشان النسخ تتسطب فوق بعض، لازم مفتاح التوقيع يبقى متحط في **Settings ← Secrets and variables ← Actions**:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`

## قواعد الحماية في فايربيز

انسخ محتوى `firebase/database.rules.json` وحطه في Firebase Console ← Realtime Database ← Rules، جنب القواعد القديمة (النسخة الجديدة كلها تحت مسار `haramiya`).
