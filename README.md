# kira kira

## English

kira kira is a minimal photo tool for adding adjustable glitter highlights to images. It supports glow, blades, bokeh, blend modes, original comparison, and PNG export.

## Türkçe

kira kira, görsellere ayarlanabilir parıltı efektleri eklemek için yapılmış sade bir fotoğraf aracıdır. Glow, blade, bokeh, blend mode, orijinal karşılaştırma ve PNG dışa aktarma destekler.

## Deutsch

kira kira ist ein einfaches Fotowerkzeug zum Hinzufügen einstellbarer Glitzerlichter zu Bildern. Es unterstützt Glow, Blades, Bokeh, Blend-Modi, Originalvergleich und PNG-Export.

## Français

kira kira est un outil photo minimal pour ajouter des reflets scintillants réglables aux images. Il prend en charge le glow, les blades, le bokeh, les modes de fusion, la comparaison avec l'original et l'export PNG.

## Русский

kira kira — минимальный инструмент для добавления на изображения настраиваемых блестящих бликов. Он поддерживает свечение, лучи, боке, режимы смешивания, сравнение с оригиналом и экспорт в PNG.

## Release Notes

### 0.1.0

English:
- Initial web and Windows release.
- Added photo import, glitter highlight detection, glow, blade controls, bokeh controls, blend controls, original preview, and PNG export.
- Added the kira kira logo to the app UI, favicon, desktop icon, taskbar icon, portable Windows build, and itch.io setup build.
- Added a YCSWU Tools discovery manifest.

Türkçe:
- İlk web ve Windows sürümü.
- Fotoğraf ekleme, parıltı algılama, glow, blade kontrolleri, bokeh kontrolleri, blend kontrolleri, orijinal önizleme ve PNG dışa aktarma eklendi.
- kira kira logosu uygulama arayüzüne, favicon'a, masaüstü ikonuna, görev çubuğu ikonuna, portable Windows build'e ve itch.io setup build'e eklendi.
- YCSWU Tools keşif manifesti eklendi.

Deutsch:
- Erste Web- und Windows-Version.
- Fotoimport, Glitzererkennung, Glow, Blade-Steuerung, Bokeh-Steuerung, Blend-Steuerung, Originalvorschau und PNG-Export wurden hinzugefügt.
- Das kira kira Logo wurde zur App-Oberfläche, zum Favicon, Desktop-Icon, Taskleisten-Icon, portablen Windows-Build und itch.io-Setup-Build hinzugefügt.
- Ein YCSWU Tools Discovery Manifest wurde hinzugefügt.

Français:
- Première version web et Windows.
- Ajout de l'import photo, de la détection des reflets, du glow, des contrôles de blades, des contrôles de bokeh, des contrôles de fusion, de l'aperçu original et de l'export PNG.
- Le logo kira kira a été ajouté à l'interface de l'app, au favicon, à l'icône de bureau, à l'icône de barre des tâches, au build Windows portable et au setup itch.io.
- Un manifeste de découverte YCSWU Tools a été ajouté.

Русский:
- Первый выпуск для веба и Windows.
- Добавлены импорт фото, обнаружение блестящих бликов, свечение, настройки лучей, настройки боке, режимы смешивания, просмотр оригинала и экспорт PNG.
- Логотип kira kira добавлен в интерфейс приложения, favicon, значок рабочего стола, значок панели задач, portable Windows build и itch.io setup build.
- Добавлен discovery manifest для YCSWU Tools.

## Outputs

- `web app/` - upload the contents of this folder to cPanel.
- `windows app/kira-kira-portable-0.1.0.exe` - portable Windows build for GitHub releases.
- `itch build/kira-kira-setup-0.1.0.exe` - Windows setup installer for itch.io.

## Build

```bash
npm install
npm run build:web
npm run pack:windows
npm run pack:itch
```
