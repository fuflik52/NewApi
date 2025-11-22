// Figma Plugin: Frame to Rust CUI Exporter (normalized anchors approach)
// FIXED: Масштабирование работает корректно с нормализованными якорями
// - Контейнер .Center создается с размером 1920*scale x 1080*scale
// - Все элементы используют нормализованные якоря (0..1) относительно контейнера
// - При изменении scale контейнер пересоздается, элементы автоматически масштабируются
// - Команды плагина: <cmd> scale <0.5-1.0> | <cmd> bigger | <cmd> smaller
// - Подробные логи координат при генерации

const USE_NORMALIZED_ANCHORS = true;
const MIN_UI_SCALE = 0.5;
const MAX_UI_SCALE = 1.0;
const API_BASE = 'https://bublickrust.ru';
let currentApiToken = '';
let currentAssetMode = 'urls'; // 'urls' | 'data'
let currentAnchorMode = 'corners'; // 'corners' | 'center'
// Масштабирование теперь управляется внутри сгенерированного C#-плагина (перс-параметр 0.5..1.0)
let currentRootFrame = null;
let pendingUploadResolve = null; // Ожидание завершения загрузки изображений из UI

// Show UI
figma.showUI(__html__, {
  width: 500,
  height: 800,
  themeColors: true
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'request-init') {
      const saved = await figma.clientStorage.getAsync('apiToken');
      currentApiToken = saved || '';
      figma.ui.postMessage({ type: 'init', token: currentApiToken });
      figma.ui.postMessage({ type: 'log', message: `🔐 Токен загружен локально (длина=${(currentApiToken || '').length})` });
    } else if (msg.type === 'save-token') {
      currentApiToken = msg.apiToken || '';
      await figma.clientStorage.setAsync('apiToken', currentApiToken);
      figma.ui.postMessage({ type: 'log', message: '💾 Токен сохранён локально' });
      figma.ui.postMessage({ type: 'token-saved', length: (currentApiToken || '').length });
    } else if (msg.type === 'generate-code') {
      if (typeof msg.apiToken === 'string') {
        currentApiToken = msg.apiToken;
        await figma.clientStorage.setAsync('apiToken', currentApiToken);
      }
      if (typeof msg.assetMode === 'string') {
        currentAssetMode = msg.assetMode === 'data' ? 'data' : 'urls';
        figma.ui.postMessage({ type: 'log', message: `🖼️ Режим ассетов: ${currentAssetMode}` });
      }
      if (typeof msg.anchorMode === 'string') {
        currentAnchorMode = msg.anchorMode === 'center' ? 'center' : 'corners';
        figma.ui.postMessage({ type: 'log', message: `📐 Режим генерации: ${currentAnchorMode === 'center' ? 'от центра' : 'по углам'}` });
      }
      // Масштаб больше не поддерживается и игнорируется

      await generateCode();
    } else if (msg.type === 'text-to-uppercase') {
      await convertSelectedTextToUppercase();
    } else if (msg.type === 'align-text-to-rectangles') {
      await alignTextToRectangles();
    } else if (msg.type === 'align-text-heights') {
      await alignTextHeights();
    } else if (msg.type === 'download-all-images') {
      await downloadAllImagesFromFrame();
    } else if (msg.type === 'keep-only-images') {
      await keepOnlyImagesInFrame();
    } else if (msg.type === 'upload-complete') {
      try {
        const results = msg.results || {};
        const map = new Map(Object.entries(results));
        if (pendingUploadResolve) {
          pendingUploadResolve(map);
          pendingUploadResolve = null;
          figma.ui.postMessage({ type: 'log', message: '📋 Загрузка изображений завершена, продолжаю генерацию кода' });
        } else {
          figma.ui.postMessage({ type: 'log', message: '⚠️ Ответ upload-complete получен без ожидающего запроса' });
        }
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: `❌ Ошибка обработки upload-complete: ${e.message}` });
      }
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    } else if (msg.type === 'request-debug') {
      try {
        await dumpSelectionDebug();
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: `❌ Debug error: ${e.message}` });
      }
    }
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
};

function setRootFrame(frame) {
  currentRootFrame = frame;
}

function getRootFrameFallback(node) {
  if (node && node.type === 'FRAME') return node;
  const sel = figma.currentPage.selection[0];
  if (sel && sel.type === 'FRAME') return sel;
  const frames = figma.currentPage.findChildren(n => n.type === 'FRAME');
  return frames.length ? frames[0] : null;
}

async function generateCode() {
  figma.ui.postMessage({ type: 'log', message: 'Начинаю генерацию...' });

  const node = figma.currentPage.selection[0];
  if (!node || node.type !== 'FRAME') {
    figma.ui.postMessage({ type: 'error', message: 'Выберите корневой Frame в Figma' });
    return;
  }

  setRootFrame(node);
  const frameName = node.name || 'Plugin';

  try {
    // Собираем все элементы для логирования
    const elements = [];
    collectAllElements(node, elements);

    figma.ui.postMessage({ type: 'log', message: `📦 Фрейм: ${frameName}` });
    figma.ui.postMessage({ type: 'log', message: `📋 Найдено элементов: ${elements.length}` });

    // Логируем типы элементов
    const typeCounts = {};
    elements.forEach(el => {
      const type = el.type || 'UNKNOWN';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    for (const [type, count] of Object.entries(typeCounts)) {
      figma.ui.postMessage({ type: 'log', message: `  • ${type}: ${count}` });
    }

    const imageMap = await uploadAllImages(node, currentApiToken);

    const cuiCode = generateRustCUI(node, imageMap);
    const csharpCode = generateCSharpCode(node, imageMap, currentAssetMode, currentAnchorMode);

    // Debug summary for root
    const rf = currentRootFrame || getRootFrameFallback(node);
    if (rf && 'width' in rf && 'height' in rf) {
      figma.ui.postMessage({ type: 'log', message: `📐 Root size: ${Math.round(rf.width)} x ${Math.round(rf.height)}` });
    }

    figma.ui.postMessage({ type: 'code-generated', cui: cuiCode, csharp: csharpCode, frameName: frameName });
    figma.ui.postMessage({ type: 'log', message: 'Готово! Код доступен для копирования' });
    figma.ui.postMessage({ type: 'log', message: '🎉 Генерация завершена!' });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
}


// Функция для сбора всех элементов
function collectAllElements(node, arr) {
  if (!node) return;
  try { if (!node.visible) return; } catch (_) { }
  try { if (typeof node.opacity === 'number' && node.opacity <= 0) return; } catch (_) { }
  arr.push(node);
  if ('children' in node) {
    for (const child of node.children) {
      collectAllElements(child, arr);
    }
  }
}

// ===== GENERATION: Rust CUI (summary style) =====
function generateRustCUI(node, imageMap) {
  const elements = [];
  traverseForCUI(node, elements, imageMap, 'root');

  // Simple string output
  let out = '/* Rust CUI Elements (summary) */\n';
  for (const el of elements) {
    out += `// ${el.name} => parent=${el.parent}\n`;
    for (const c of el.components) {
      out += `//   - ${c.type} ${c.anchormin ? `[${c.anchormin}..${c.anchormax}]` : ''}\n`;
    }
  }
  return out;
}

function traverseForCUI(node, elements, imageMap, parentName = 'root') {
  const element = { name: sanitizeClassName(`${parentName}_${node.name}`), parent: parentName };

  // Сначала проверяем, есть ли изображение (включая экспортированные элементы)
  if (hasImageFill(node, imageMap)) {
    const imageUrl = getImageUrl(node, imageMap);
    element.components = [{ type: 'UnityEngine.UI.RawImage', url: imageUrl, color: '1 1 1 1' }];
  } else if (node.type === 'TEXT') {
    element.components = [{ type: 'UnityEngine.UI.Text', text: node.characters || '', fontSize: node.fontSize || 14, color: getFillColor(node), align: getTextAlign(node) }];
  } else {
    element.components = [{ type: 'UnityEngine.UI.Image', color: getFillColor(node) || '1 1 1 0.5' }];
  }

  if (USE_NORMALIZED_ANCHORS) {
    const nrm = calculateNormalizedAnchors(node);
    element.components.push({ type: 'RectTransform', anchormin: nrm.min, anchormax: nrm.max, offsetmin: '0 0', offsetmax: '0 0' });
  } else {
    const px = calculatePixelCoordinates(node);
    element.components.push({ type: 'RectTransform', anchormin: '0 0', anchormax: '0 0', offsetmin: `${px.minX} ${px.minY}`, offsetmax: `${px.maxX} ${px.maxY}` });
  }

  elements.push(element);

  if ('children' in node) {
    for (const child of node.children) {
      traverseForCUI(child, elements, imageMap, element.name);
    }
  }
}

// ===== GENERATION: C# Oxide Plugin =====

// Определяет anchor point для отдельного элемента на основе его позиции
function detectElementAnchor(node, rootWidth, rootHeight, rfBounds, anchorMode = 'corners') {
  const b = getAbsoluteBounds(node);
  const centerX = (b.x - rfBounds.x) + b.width * 0.5;
  const centerY = (b.y - rfBounds.y) + b.height * 0.5;

  const normX = centerX / rootWidth;
  const normY = centerY / rootHeight;
  const normYInverted = 1.0 - normY;

  let anchorX = 0.5, anchorY = 0.5;

  // Режим от центра - все элементы привязываются к центру
  if (anchorMode === 'center') {
    return { ax: 0.5, ay: 0.5 };
  }

  // Режим по углам - определяем anchor на основе позиции
  // Определяем горизонтальный anchor
  if (normX > 0.75) anchorX = 1.0;      // right
  else if (normX < 0.25) anchorX = 0.0; // left
  else anchorX = 0.5;                    // center

  // Определяем вертикальный anchor (инвертированный)
  if (normYInverted > 0.75) anchorY = 1.0;      // top
  else if (normYInverted < 0.25) anchorY = 0.0; // bottom
  else anchorY = 0.5;                            // center

  return { ax: anchorX, ay: anchorY };
}

function generateCSharpCode(node, imageMap, assetMode, anchorMode = 'corners') {
  const className = toPascalCase(sanitizeClassName(node.name));
  const uiName = className;
  const commandName = className.toLowerCase();
  const rootWidth = Math.round(('width' in node ? node.width : 1104) || 1104);
  const rootHeight = Math.round(('height' in node ? node.height : 738) || 738);
  const assetKeys = new Set();

  const anchorModeText = anchorMode === 'center' ? 'от центра (центрировано)' : 'по углам (адаптивно)';
  figma.ui.postMessage({ type: 'log', message: `✨ Режим генерации: ${anchorModeText}` });

  let code = `using Oxide.Core;\n`;
  code += `using Oxide.Core.Plugins;\n`;
  code += `using Oxide.Game.Rust.Cui;\n`;
  code += `using System;\n`;
  code += `using System.Collections.Generic;\n`;
  code += `using System.Globalization;\n`;
  code += `using UnityEngine;\n\n`;
  code += `namespace Oxide.Plugins\n{\n`;
  code += `    [Info("${className}UI", "BublickRust", "1.0.0")]\n`;
  code += `    [Description("Auto-generated UI from Figma")]\n`;
  code += `    class ${className}UI : RustPlugin\n    {\n`;
  if (assetMode === 'data') {
    code += `        private class UIAssetsLoader\n        {\n`;
    code += `            private readonly Dictionary<string, string> _ids = new Dictionary<string, string>();\n`;
    code += `            private readonly string _pluginName;\n`;
    code += `            private readonly ${className}UI _plugin;\n`;
    code += `            private readonly HashSet<string> _missingLogged = new HashSet<string>();\n`;
    code += `            private bool _cancel;\n`;
    code += `            public int Requested { get; private set; }\n`;
    code += `            public int Loaded { get; private set; }\n`;
    code += `            public int Failed { get; private set; }\n`;
    code += `            public UIAssetsLoader(string pluginName, ${className}UI plugin) { _pluginName = pluginName; _plugin = plugin; }\n`;
    code += `            public void StartLoad(IEnumerable<string> keys) { _cancel = false; ServerMgr.Instance.StartCoroutine(LoadRoutine(keys)); }\n`;
    code += `            public void Cancel() { _cancel = true; }\n`;
    code += `            private System.Collections.IEnumerator LoadRoutine(IEnumerable<string> keys)\n            {\n`;
    code += `                foreach (var key in keys)\n                {\n`;
    code += `                    if (_cancel) yield break;\n`;
    code += `                    var path = $"file://{Interface.Oxide.DataDirectory}/{_pluginName}/Images/{key}.png";\n`;
    code += `                    using (var req = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(path))\n                    {\n`;
    code += `                        Requested++;\n`;
    code += `                        yield return req.SendWebRequest();\n`;
    code += `                        if (req.result == UnityEngine.Networking.UnityWebRequest.Result.ConnectionError || req.result == UnityEngine.Networking.UnityWebRequest.Result.ProtocolError)\n                        {\n`;
    code += `                            Failed++;\n`;
    code += `                            _plugin?.PrintWarning($"[UIAssets] Not found or failed: '{key}' => {path} ({req.error})");\n`;
    code += `                        }\n`;
    code += `                        else\n                        {\n`;
    code += `                            var tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(req);\n`;
    code += `                            if (tex != null)\n                            {\n`;
    code += `                                var bytes = tex.EncodeToPNG();\n`;
    code += `                                var id = FileStorage.server.Store(bytes, FileStorage.Type.png, CommunityEntity.ServerInstance.net.ID).ToString();\n`;
    code += `                                _ids[key] = id;\n`;
    code += `                                Loaded++;\n`;
    code += `                                UnityEngine.Object.DestroyImmediate(tex);\n`;
    code += `                            }\n`;
    code += `                            else { Failed++; }\n`;
    code += `                        }\n`;
    code += `                    }\n`;
    code += `                    yield return null;\n`;
    code += `                }\n`;
    code += `                _plugin?.Puts($"[UIAssets] Requested: {Requested}, Loaded: {Loaded}, Failed: {Failed}");\n`;
    code += `            }\n`;
    code += `            public string Get(string key)\n            {\n`;
    code += `                if (_ids.TryGetValue(key, out var id)) return id;\n`;
    code += `                if (_missingLogged.Add(key)) _plugin?.PrintWarning($"[UIAssets] Png id for key '{key}' is missing. Place file at data/{_pluginName}/Images/{key}.png");\n`;
    code += `                return null;\n`;
    code += `            }\n`;
    code += `        }\n`;
    code += `        private UIAssetsLoader assets = null;\n`;
  }
  code += `        private const string UIName = "${uiName}";\n`;
  code += `        private const float MinScale = ${MIN_UI_SCALE.toFixed(1)}f;\n`;
  code += `        private const float MaxScale = ${MAX_UI_SCALE.toFixed(1)}f;\n`;
  code += `        private const float DefaultScale = 0.67f;\n`;
  code += `        private const float DesignWidth = ${rootWidth}f;\n`;
  code += `        private const float DesignHeight = ${rootHeight}f;\n`;
  code += `        private readonly HashSet<ulong> playersWithUI = new HashSet<ulong>();\n`;
  code += `        private readonly Dictionary<ulong, float> playerScale = new Dictionary<ulong, float>();\n\n`;
  code += `        private float GetScale(BasePlayer player)\n        {\n`;
  code += `            if (player == null) return DefaultScale;\n`;
  code += `            float s;\n`;
  code += `            if (playerScale.TryGetValue(player.userID, out s)) return Mathf.Clamp(s, MinScale, MaxScale);\n`;
  code += `            return DefaultScale;\n`;
  code += `        }\n\n`;
  code += `        private void SetScale(BasePlayer player, float value)\n        {\n`;
  code += `            if (player == null) return;\n`;
  code += `            var clamped = Mathf.Clamp(value, MinScale, MaxScale);\n`;
  code += `            playerScale[player.userID] = clamped;\n`;
  code += `        }\n\n`;

  // Chat command to toggle UI
  code += `        [ChatCommand("${commandName}")]\n`;
  code += `        void CmdToggleUI(BasePlayer player, string command, string[] args)\n        {\n`;
  code += `            if (args != null && args.Length > 0)\n            {\n`;
  code += `                var sub = (args[0] ?? string.Empty).ToLowerInvariant();\n`;
  code += `                if (sub == "scale" || sub == "s")\n                {\n`;
  code += `                    if (args.Length < 2)\n                    {\n`;
  code += `                        var cur = GetScale(player);\n`;
  code += `                        player.ChatMessage($"Текущий масштаб UI: {cur:0.00} (мин {MinScale:0.00}, макс {MaxScale:0.00})");\n`;
  code += `                        return;\n`;
  code += `                    }\n`;
  code += `                    float v;\n`;
  code += `                    if (!float.TryParse(args[1], NumberStyles.Float, CultureInfo.InvariantCulture, out v))\n                    {\n`;
  code += `                        player.ChatMessage("Некорректное число. Пример: /${commandName} scale 0.85");\n`;
  code += `                        return;\n`;
  code += `                    }\n`;
  code += `                    SetScale(player, v);\n`;
  code += `                    if (HasUI(player)) ShowUI(player); else ShowUI(player);\n`;
  code += `                    return;\n`;
  code += `                }\n`;
  code += `                if (sub == "bigger" || sub == "+")\n                {\n`;
  code += `                    SetScale(player, GetScale(player) + 0.05f);\n`;
  code += `                    if (HasUI(player)) ShowUI(player); else ShowUI(player);\n`;
  code += `                    return;\n`;
  code += `                }\n`;
  code += `                if (sub == "smaller" || sub == "-")\n                {\n`;
  code += `                    SetScale(player, GetScale(player) - 0.05f);\n`;
  code += `                    if (HasUI(player)) ShowUI(player); else ShowUI(player);\n`;
  code += `                    return;\n`;
  code += `                }\n`;
  code += `            }\n`;
  code += `            if (HasUI(player)) CloseUI(player); else ShowUI(player);\n`;
  code += `        }\n\n`;

  // Console command for direct scaling
  code += `        [ConsoleCommand("${commandName}.scale")]\n`;
  code += `        void CmdScale(ConsoleSystem.Arg arg)\n        {\n`;
  code += `            var player = arg?.Player();\n`;
  code += `            if (player == null) return;\n`;
  code += `            var s = arg.GetFloat(0, GetScale(player));\n`;
  code += `            SetScale(player, s);\n`;
  code += `            if (HasUI(player)) ShowUI(player); else ShowUI(player);\n`;
  code += `        }\n\n`;

  // UI helpers
  code += `        private bool HasUI(BasePlayer player) { return playersWithUI.Contains(player.userID); }\n\n`;
  code += `        private void ShowUI(BasePlayer player)\n        {\n`;
  code += `            CloseUI(player);\n`;
  code += `            playersWithUI.Add(player.userID);\n\n`;
  code += `            var elements = new CuiElementContainer();\n`;
  code += `            var scale = GetScale(player);\n`;
  if (assetMode === 'data') {
    code += `            if (assets == null) { Puts("[UI] Warning: assets loader is not initialized yet. Images may be missing."); }\n`;
  }

  // Root overlay
  code += `            elements.Add(new CuiPanel\n`;
  code += `            {\n`;
  code += `                Image = { Color = "0 0 0 0" },\n`;
  code += `                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "0 0", OffsetMax = "0 0" },\n`;
  code += `                CursorEnabled = false,\n`;
  code += `                FadeOut = 0.1f\n`;
  code += `            }, "Overlay", UIName);\n\n`;

  code += `            var s = Mathf.Clamp(scale, MinScale, MaxScale);\n`;
  code += `            Puts($"[${className}UI] ShowUI для игрока {player.displayName}, Scale={s:0.00}");\n\n`;

  // Log detailed generation info
  figma.ui.postMessage({ type: 'log', message: `\n📐 Генерация элементов UI [магнитные anchors]:` });
  figma.ui.postMessage({ type: 'log', message: `  Root Frame: ${node.name} (${rootWidth}x${rootHeight}px)` });
  figma.ui.postMessage({ type: 'log', message: `  Parent Container: UIName (fullscreen)` });
  const childCount = ('children' in node) ? node.children.length : 0;
  figma.ui.postMessage({ type: 'log', message: `  Children: ${childCount} элементов\n` });

  code += generateCSharpElementsWithMagneticAnchors(node, `UIName`, 3, imageMap, commandName, rootWidth, rootHeight, assetMode, assetKeys, null, anchorMode);

  figma.ui.postMessage({ type: 'log', message: `✅ Генерация элементов завершена` });

  code += `            CuiHelper.AddUi(player, elements);\n`;
  code += `        }\n\n`;

  code += `        private void CloseUI(BasePlayer player)\n        {\n`;
  code += `            CuiHelper.DestroyUi(player, UIName);\n`;
  code += `            playersWithUI.Remove(player.userID);\n`;
  code += `        }\n\n`;

  code += `        void OnPlayerDisconnected(BasePlayer player) { playersWithUI.Remove(player.userID); }\n\n`;
  if (assetMode === 'data') {
    code += `        void Unload() { assets?.Cancel(); foreach (var p in BasePlayer.activePlayerList) CloseUI(p); playersWithUI.Clear(); }\n`;
  } else {
    code += `        void Unload() { foreach (var p in BasePlayer.activePlayerList) CloseUI(p); playersWithUI.Clear(); }\n`;
  }
  if (assetMode === 'data') {
    const keysArr = Array.from(assetKeys);
    const keysLiteral = keysArr.map(k => `"${k}"`).join(', ');
    code += `        private static readonly string[] _assetKeys = new string[] { ${keysLiteral} };\n`;
    code += `        void OnServerInitialized()\n        {\n`;
    code += `            // Создаем директорию для изображений, если её нет\n`;
    code += `            var imagesDir = System.IO.Path.Combine(Interface.Oxide.DataDirectory, "${className}UI", "Images");\n`;
    code += `            if (!System.IO.Directory.Exists(imagesDir))\n`;
    code += `            {\n`;
    code += `                System.IO.Directory.CreateDirectory(imagesDir);\n`;
    code += `                Puts($"[${className}UI] Создана директория для изображений: {imagesDir}");\n`;
    code += `                Puts($"[${className}UI] Поместите PNG файлы в эту директорию с именами: {string.Join(", ", _assetKeys)}");\n`;
    code += `            }\n`;
    code += `            assets = new UIAssetsLoader("${className}UI", this);\n`;
    code += `            assets.StartLoad(_assetKeys);\n`;
    code += `        }\n`;
    code += `        [ChatCommand("${commandName}assets")]\n`;
    code += `        void CmdAssets(BasePlayer player, string command, string[] args)\n        {\n`;
    code += `            if (assets == null) { player.ChatMessage("Assets: loader not initialized"); return; }\n`;
    code += `            var imagesDir = System.IO.Path.Combine(Interface.Oxide.DataDirectory, "${className}UI", "Images");\n`;
    code += `            player.ChatMessage($"Assets: requested={assets.Requested}, loaded={assets.Loaded}, failed={assets.Failed}");\n`;
    code += `            player.ChatMessage($"Images directory: {imagesDir}");\n`;
    code += `        }\n`;
  }
  code += `    }\n`;
  code += `}\n`;

  return code;
}

function isButtonByName(nodeName) {
  if (!nodeName) return false;
  const n = nodeName.toLowerCase();
  return n.includes('button') || n.includes('btn') || n.includes('кноп');
}

// Генерация элементов с магнитными anchors (каждый элемент прилипает к своему углу)
function generateCSharpElementsWithMagneticAnchors(node, parentName, level, imageMap, commandName, rootWidth, rootHeight, assetMode = 'urls', assetKeysSet = null, rootFrame = null, anchorMode = 'corners', cuiParentNode = null, overrideParentPx = null) {
  let code = '';
  const indent = '        ' + '    '.repeat(level);

  // Получаем rootFrame один раз для всех дочерних элементов
  if (!rootFrame) {
    rootFrame = currentRootFrame || getRootFrameFallback(node);
  }

  // Определяем реального CUI-родителя для расчета координат
  // Если cuiParentNode не передан, считаем что родитель - это rootFrame (для верхнего уровня)
  // Если мы внутри invisible container, то cuiParentNode будет передан от вышестоящего уровня
  const actualParent = cuiParentNode || rootFrame;

  // Вычисляем координаты родителя относительно rootFrame
  let parentPx = overrideParentPx;
  if (!parentPx) {
    parentPx = { minX: 0, minY: 0, maxX: rootWidth, maxY: rootHeight };

    // Если родитель не является rootFrame, вычисляем его координаты
    if (actualParent.id !== rootFrame.id) {
      parentPx = calculatePixelCoordinates(actualParent);
    }
  }

  const parentWidth = Math.max(1, parentPx.maxX - parentPx.minX);
  const parentHeight = Math.max(1, parentPx.maxY - parentPx.minY);
  const parentMinX = parentPx.minX;
  const parentMinY = parentPx.minY;

  if ('children' in node) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childName = sanitizeClassName(`${node.name}_${child.name}_${i}`);
      const nameForLog = escapeCSharpString(child.name || '');
      const childW = 'width' in child ? Math.round(child.width) : 0;
      const childH = 'height' in child ? Math.round(child.height) : 0;

      // Проверяем видимость элемента в родительских фреймах с clipsContent
      if (!isElementVisibleInClippingFrames(child, rootFrame)) {
        continue; // Элемент полностью невидим - пропускаем
      }

      // Получаем координаты элемента (уже обрезанные если нужно)
      const px = calculatePixelCoordinates(child);

      // Пропускаем элементы, которые полностью вне фрейма (обрезаны до нулевого размера)
      if (px.minX >= px.maxX || px.minY >= px.maxY) {
        continue;
      }

      // ВАЖНО: Переводим координаты в относительные (относительно actualParent)
      const relPx = {
        minX: px.minX - parentMinX,
        minY: px.minY - parentMinY,
        maxX: px.maxX - parentMinX,
        maxY: px.maxY - parentMinY
      };

      // ВАЖНО: Определяем anchor на основе ОБРЕЗАННЫХ ОТНОСИТЕЛЬНЫХ координат
      // Вычисляем центр обрезанного элемента
      const clippedCenterX = (relPx.minX + relPx.maxX) / 2;
      const clippedCenterY = (relPx.minY + relPx.maxY) / 2;

      let anchorX = 0.5, anchorY = 0.5;
      let offsetMinX, offsetMinY, offsetMaxX, offsetMaxY;

      if (anchorMode === 'center') {
        // Режим от центра - все элементы привязываются к центру родителя
        anchorX = 0.5;
        anchorY = 0.5;

        // В режиме center offsets должны сохранять АБСОЛЮТНУЮ позицию элемента
        // относительно центра родителя
        const centerX = parentWidth / 2;
        const centerY = parentHeight / 2;

        offsetMinX = Math.round(relPx.minX - centerX);
        offsetMinY = Math.round(relPx.minY - centerY);
        offsetMaxX = Math.round(relPx.maxX - centerX);
        offsetMaxY = Math.round(relPx.maxY - centerY);
      } else {
        // Режим по углам - определяем anchor на основе позиции внутри родителя
        const normX = clippedCenterX / parentWidth;
        const normY = clippedCenterY / parentHeight;

        if (normX > 0.75) anchorX = 1.0;
        else if (normX < 0.25) anchorX = 0.0;
        else anchorX = 0.5;

        if (normY > 0.75) anchorY = 1.0;
        else if (normY < 0.25) anchorY = 0.0;
        else anchorY = 0.5;

        // Вычисляем offset от anchor point
        offsetMinX = Math.round(relPx.minX - anchorX * parentWidth);
        offsetMinY = Math.round(relPx.minY - anchorY * parentHeight);
        offsetMaxX = Math.round(relPx.maxX - anchorX * parentWidth);
        offsetMaxY = Math.round(relPx.maxY - anchorY * parentHeight);
      }

      const anchorStr = `${anchorX.toFixed(1)} ${anchorY.toFixed(1)}`;

      // Проверяем, нужно ли экспортировать как изображение (только для специальных случаев)
      const shouldExport = shouldExportAsImage(child);
      const hasImageFillValue = hasImageFill(child, imageMap);
      // ВАЖНО: Текст НИКОГДА не экспортируется как изображение (даже если shouldExport вернул true)
      // Boolean операции, Line, Star, Polygon всегда имеют hasImage=true если shouldExport=true
      const isVectorElement = child.type === 'BOOLEAN_OPERATION' ||
        child.type === 'LINE' ||
        child.type === 'STAR' ||
        child.type === 'POLYGON';
      const hasImage = child.type !== 'TEXT' && (hasImageFillValue || shouldExport);
      const imageUrl = (assetMode === 'urls' && hasImage) ? getImageUrl(child, imageMap) : null;
      // Вычисляем ключ изображения - имя файла из Figma
      let imageKey = null;
      if (hasImage) {
        imageKey = getImageFileName(child, imageMap);
        // Если не нашли по новому формату, пробуем старый
        if (!imageKey) {
          const expKey = `export_${child.id}`;
          if (imageMap.has(expKey)) {
            imageKey = sanitizeFileName(child.name || `export_${child.id.substring(0, 8)}`);
          } else if ('fills' in child && Array.isArray(child.fills)) {
            for (const f of child.fills) {
              if (f.type === 'IMAGE' && f.imageHash && imageMap.has(f.imageHash)) {
                imageKey = sanitizeFileName(child.name || `image_${f.imageHash.substring(0, 8)}`);
                break;
              }
            }
          }
        }
      }
      const safeKey = imageKey ? imageKey.replace(/[^A-Za-z0-9._-]/g, '_') : null;
      if (assetMode === 'data' && safeKey && assetKeysSet) assetKeysSet.add(safeKey);

      // ВАЖНО: Текст НЕ должен попадать сюда (проверка выше)
      // Для Boolean операций и векторных элементов проверяем наличие URL/ключа
      // Если это векторный элемент без URL - пропускаем (значит не был экспортирован)
      const hasValidImageSource = assetMode === 'urls' ? !!imageUrl : !!safeKey;

      // DEBUG: Логируем Boolean операции
      if (child.type === 'BOOLEAN_OPERATION') {
        figma.ui.postMessage({
          type: 'log',
          message: `🔍 DEBUG Union "${child.name}": shouldExport=${!!shouldExport}, hasImage=${hasImage}, imageUrl=${!!imageUrl ? imageUrl.substring(0, 50) + '...' : 'NULL'}, safeKey=${!!safeKey}, hasValidImageSource=${hasValidImageSource}, isVectorElement=${isVectorElement}`
        });
      }

      if (child.type !== 'TEXT' && shouldExport && hasImage && hasValidImageSource) {
        // Обычный экспорт элемента как изображения
        if (assetMode === 'urls') {
          code += `${indent}elements.Add(new CuiElement { Parent = ${parentName}, Components = { new CuiRawImageComponent { Url = "${imageUrl}" }, new CuiRectTransformComponent { AnchorMin = "${anchorStr}", AnchorMax = "${anchorStr}", OffsetMin = $"{Mathf.RoundToInt(${offsetMinX} * s)} {Mathf.RoundToInt(${offsetMinY} * s)}", OffsetMax = $"{Mathf.RoundToInt(${offsetMaxX} * s)} {Mathf.RoundToInt(${offsetMaxY} * s)}" } } });\n`;
        } else {
          code += `${indent}elements.Add(new CuiElement { Parent = ${parentName}, Components = { new CuiRawImageComponent { Png = assets.Get("${safeKey}") }, new CuiRectTransformComponent { AnchorMin = "${anchorStr}", AnchorMax = "${anchorStr}", OffsetMin = $"{Mathf.RoundToInt(${offsetMinX} * s)} {Mathf.RoundToInt(${offsetMinY} * s)}", OffsetMax = $"{Mathf.RoundToInt(${offsetMaxX} * s)} {Mathf.RoundToInt(${offsetMaxY} * s)}" } } });\n`;
        }

      } else if (child.type === 'TEXT') {
        const textColor = getRGBAColor(child);
        const textAlign = getTextAlign(child);
        const originalText = child.characters || '';
        const escapedText = escapeCSharpString(originalText);
        const fontSizeValue = typeof child.fontSize === 'number' ? child.fontSize : 14;
        const baseFontSize = Math.max(1, Math.round(fontSizeValue));

        // Calculate LineSpacing
        let lineSpacing = 1.0;
        if (child.lineHeight) {
          if (child.lineHeight.unit === 'PIXELS') {
            lineSpacing = baseFontSize > 0 ? child.lineHeight.value / baseFontSize : 1.0;
          } else if (child.lineHeight.unit === 'PERCENT') {
            lineSpacing = child.lineHeight.value / 100;
          }
        }

        // FIX: Ensure text frame is large enough to display text
        // If frame height is smaller than fontSize * 1.5, expand it
        const currentHeight = offsetMaxY - offsetMinY;
        const minHeight = baseFontSize * 1.5;
        if (currentHeight < minHeight) {
          const diff = minHeight - currentHeight;
          offsetMinY -= Math.round(diff / 2);
          offsetMaxY += Math.round(diff / 2);
        }

        code += `${indent}// Text: ${escapedText}\n`;
        code += `${indent}elements.Add(new CuiLabel\n`;
        code += `${indent}{\n`;
        code += `${indent}    Text = { Text = "${escapedText}", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(${baseFontSize} * s)), Align = TextAnchor.${textAlign}, Color = "${textColor}" },\n`;
        code += `${indent}    RectTransform = { AnchorMin = "${anchorStr}", AnchorMax = "${anchorStr}", OffsetMin = $"{Mathf.RoundToInt(${offsetMinX} * s)} {Mathf.RoundToInt(${offsetMinY} * s)}", OffsetMax = $"{Mathf.RoundToInt(${offsetMaxX} * s)} {Mathf.RoundToInt(${offsetMaxY} * s)}" }\n`;
        code += `${indent}}, ${parentName});\n\n`;

      } else {
        const color = getRGBAColor(child);

        // Проверяем, является ли это невидимой группой/фреймом (контейнер без фона)
        const isInvisibleContainer = (child.type === 'GROUP' || child.type === 'FRAME') && (!color || color === '0 0 0 0') && !hasImage;

        if (isInvisibleContainer) {
          // Рекурсивно обрабатываем дочерние элементы без создания контейнера
          // ВАЖНО: Передаем actualParent как cuiParentNode, так как мы не создали новый CUI контейнер
          // ВАЖНО: Передаем parentPx как overrideParentPx, так как мы продолжаем использовать ту же систему координат
          code += generateCSharpElementsWithMagneticAnchors(child, parentName, level, imageMap, commandName, rootWidth, rootHeight, assetMode, assetKeysSet, rootFrame, anchorMode, actualParent, parentPx);
        } else {
          const isButton = isButtonByName(child.name);

          if (isButton) {
            const buttonName = sanitizeClassName(child.name);
            const buttonCommand = `${commandName}.button ${buttonName}`;

            code += `${indent}// Button: ${child.name}\n`;
            code += `${indent}elements.Add(new CuiButton\n`;
            code += `${indent}{\n`;
            code += `${indent}    Button = { Color = "${color}", Command = "${buttonCommand}" },\n`;
            code += `${indent}    RectTransform = { AnchorMin = "${anchorStr}", AnchorMax = "${anchorStr}", OffsetMin = $"{Mathf.RoundToInt(${offsetMinX} * s)} {Mathf.RoundToInt(${offsetMinY} * s)}", OffsetMax = $"{Mathf.RoundToInt(${offsetMaxX} * s)} {Mathf.RoundToInt(${offsetMaxY} * s)}" },\n`;
            code += `${indent}    Text = { Text = "", Color = "0 0 0 0" }\n`;
            code += `${indent}}, ${parentName}, "${childName}");\n\n`;

            // ВАЖНО: Передаем child как новый cuiParentNode
            // ВАЖНО: Передаем px как overrideParentPx для дочерних элементов
            code += generateCSharpElementsWithMagneticAnchors(child, `"${childName}"`, level + 1, imageMap, commandName, rootWidth, rootHeight, assetMode, assetKeysSet, rootFrame, anchorMode, child, px);
          } else {
            code += `${indent}// Panel: ${child.name}\n`;
            code += `${indent}elements.Add(new CuiPanel\n`;
            code += `${indent}{\n`;
            code += `${indent}    Image = { Color = "${color}" },\n`;
            code += `${indent}    RectTransform = { AnchorMin = "${anchorStr}", AnchorMax = "${anchorStr}", OffsetMin = $"{Mathf.RoundToInt(${offsetMinX} * s)} {Mathf.RoundToInt(${offsetMinY} * s)}", OffsetMax = $"{Mathf.RoundToInt(${offsetMaxX} * s)} {Mathf.RoundToInt(${offsetMaxY} * s)}" }\n`;
            code += `${indent}}, ${parentName}, "${childName}");\n\n`;

            if (hasImage && (assetMode === 'urls' ? !!imageUrl : !!safeKey)) {
              code += `${indent}// Image for ${child.name}\n`;
              code += `${indent}elements.Add(new CuiElement\n`;
              code += `${indent}{\n`;
              code += `${indent}    Parent = "${childName}",\n`;
              code += `${indent}    Components =\n`;
              code += `${indent}    {\n`;
              if (assetMode === 'urls') {
                code += `${indent}        new CuiRawImageComponent { Url = "${imageUrl}" },\n`;
              } else {
                code += `${indent}        new CuiRawImageComponent { Png = assets.Get("${safeKey}") },\n`;
              }
              code += `${indent}        new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }\n`;
              code += `${indent}    }\n`;
              code += `${indent}});\n\n`;
            }
            // ВАЖНО: Передаем child как новый cuiParentNode
            // ВАЖНО: Передаем px как overrideParentPx для дочерних элементов
            code += generateCSharpElementsWithMagneticAnchors(child, `"${childName}"`, level + 1, imageMap, commandName, rootWidth, rootHeight, assetMode, assetKeysSet, rootFrame, anchorMode, child, px);
          }
        }
      }
    }
  }

  return code;
}

function generateCSharpElements(node, parentName, level, imageMap, commandName = 'ui') {
  let code = '';
  const indent = '        ' + '    '.repeat(level);

  if ('children' in node) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childName = sanitizeClassName(`${node.name}_${child.name}_${i}`);
      const nameForLog = escapeCSharpString(child.name || '');
      const childW = 'width' in child ? Math.round(child.width) : 0;
      const childH = 'height' in child ? Math.round(child.height) : 0;

      // Проверяем видимость элемента в родительских фреймах с clipsContent
      const rootFrame = currentRootFrame || getRootFrameFallback(node);
      if (!isElementVisibleInClippingFrames(child, rootFrame)) {
        continue; // Элемент полностью невидим - пропускаем
      }

      // Сначала проверяем, есть ли изображение (включая экспортированные элементы)
      const hasImage = hasImageFill(child, imageMap);
      const imageUrl = hasImage ? getImageUrl(child, imageMap) : null;

      // Проверяем координаты элемента (после обрезки)
      const px = calculatePixelCoordinates(child);
      // Пропускаем элементы, которые полностью вне фрейма (обрезаны до нулевого размера)
      if (px.minX >= px.maxX || px.minY >= px.maxY) {
        continue;
      }

      if (hasImage && imageUrl) {
        // Обычный экспорт элемента как изображения
        const nrm = calculateNormalizedAnchors(child);
        figma.ui.postMessage({ type: 'log', message: `  #${i} ${nameForLog} type=IMAGE (exported) size=${childW}x${childH} anchors=[${nrm.min}..${nrm.max}] px=[${px.minX},${px.minY}->${px.maxX},${px.maxY}]` });

        code += `${indent}// Image (exported): ${child.name}\n`;
        code += `${indent}elements.Add(new CuiElement\n`;
        code += `${indent}{\n`;
        code += `${indent}    Parent = ${parentName},\n`;
        code += `${indent}    Components =\n`;
        code += `${indent}    {\n`;
        code += `${indent}        new CuiRawImageComponent { Url = "${imageUrl}" },\n`;
        code += `${indent}        new CuiRectTransformComponent { AnchorMin = "${nrm.min}", AnchorMax = "${nrm.max}", OffsetMin = "0 0", OffsetMax = "0 0" }\n`;
        code += `${indent}    }\n`;
        code += `${indent}});\n\n`;
      } else if (child.type === 'TEXT') {
        const textColor = getRGBAColor(child);
        const textAlign = getTextAlign(child);
        const originalText = child.characters || '';
        const escapedText = escapeCSharpString(originalText);
        const fontSizeValue = typeof child.fontSize === 'number' ? child.fontSize : 14;
        const baseFontSize = Math.max(1, Math.round(fontSizeValue));

        // Calculate LineSpacing
        let lineSpacing = 1.0;
        if (child.lineHeight) {
          if (child.lineHeight.unit === 'PIXELS') {
            lineSpacing = baseFontSize > 0 ? child.lineHeight.value / baseFontSize : 1.0;
          } else if (child.lineHeight.unit === 'PERCENT') {
            lineSpacing = child.lineHeight.value / 100;
          }
        }

        // FIX: Ensure text frame is large enough
        let expandY = 0;
        const minHeight = baseFontSize * 1.5;
        if (childH < minHeight) {
          expandY = Math.round((minHeight - childH) / 2);
        }

        const nrm = calculateNormalizedAnchors(child);
        figma.ui.postMessage({ type: 'log', message: `  #${i} ${nameForLog} type=TEXT size=${childW}x${childH} anchors=[${nrm.min}..${nrm.max}] px=[${px.minX},${px.minY}->${px.maxX},${px.maxY}]` });

        code += `${indent}// Text: ${escapedText}\n`;
        code += `${indent}elements.Add(new CuiLabel\n`;
        code += `${indent}{\n`;
        code += `${indent}    Text = { Text = "${escapedText}", FontSize = (int)Mathf.Max(6, Mathf.RoundToInt(${baseFontSize} * scale)), Align = TextAnchor.${textAlign}, Color = "${textColor}" },\n`;
        code += `${indent}    RectTransform = { AnchorMin = "${nrm.min}", AnchorMax = "${nrm.max}", OffsetMin = "0 ${-expandY}", OffsetMax = "0 ${expandY}" }\n`;
        code += `${indent}}, ${parentName});\n\n`;

        // Дев-логи отключены
      } else {
        const color = getRGBAColor(child);

        const isInvisibleGroup = (child.type === 'GROUP' || child.type === 'FRAME') && (!color || color === '0 0 0 0') && !hasImage;

        if (isInvisibleGroup) {
          code += generateCSharpElements(child, parentName, level, imageMap, commandName);
        } else {
          const isButton = isButtonByName(child.name);
          const nrm = calculateNormalizedAnchors(child);
          // px уже вычислено выше

          if (isButton) {
            const buttonName = sanitizeClassName(child.name);
            const buttonCommand = `${commandName}.button ${buttonName}`;

            figma.ui.postMessage({ type: 'log', message: `  #${i} ${nameForLog} type=BUTTON size=${childW}x${childH} anchors=[${nrm.min}..${nrm.max}] px=[${px.minX},${px.minY}->${px.maxX},${px.maxY}]` });

            code += `${indent}// Button: ${child.name}\n`;
            code += `${indent}elements.Add(new CuiButton\n`;
            code += `${indent}{\n`;
            code += `${indent}    Button = { Color = "${color}", Command = "${buttonCommand}" },\n`;
            code += `${indent}    RectTransform = { AnchorMin = "${nrm.min}", AnchorMax = "${nrm.max}", OffsetMin = "0 0", OffsetMax = "0 0" },\n`;
            code += `${indent}    Text = { Text = "", Color = "0 0 0 0" }\n`;
            code += `${indent}}, ${parentName}, "${childName}");\n\n`;

            // Дев-логи отключены
            code += generateCSharpElements(child, `"${childName}"`, level + 1, imageMap, commandName);
          } else {
            figma.ui.postMessage({ type: 'log', message: `  #${i} ${nameForLog} type=${child.type} size=${childW}x${childH} anchors=[${nrm.min}..${nrm.max}] px=[${px.minX},${px.minY}->${px.maxX},${px.maxY}]` });

            // Дополнительный лог для Rectangle
            if (child.type === 'RECTANGLE') {
              const cornerType = typeof child.cornerRadius;
              const cornerValue = child.cornerRadius;
              figma.ui.postMessage({
                type: 'log',
                message: `⚠️ Rectangle "${child.name}" генерируется как CuiPanel (hasImage=${hasImage}, imageUrl=${!!imageUrl}, cornerRadius type=${cornerType}, value=${cornerValue})`
              });
            }

            code += `${indent}// Panel: ${child.name}\n`;
            code += `${indent}elements.Add(new CuiPanel\n`;
            code += `${indent}{\n`;
            code += `${indent}    Image = { Color = "${color}" },\n`;
            code += `${indent}    RectTransform = { AnchorMin = "${nrm.min}", AnchorMax = "${nrm.max}", OffsetMin = "0 0", OffsetMax = "0 0" }\n`;
            code += `${indent}}, ${parentName}, "${childName}");\n\n`;

            // Дев-логи отключены

            if (hasImage && imageUrl) {
              code += `${indent}// Image for ${child.name}\n`;
              code += `${indent}elements.Add(new CuiElement\n`;
              code += `${indent}{\n`;
              code += `${indent}    Parent = "${childName}",\n`;
              code += `${indent}    Components =\n`;
              code += `${indent}    {\n`;
              code += `${indent}        new CuiRawImageComponent { Url = "${imageUrl}" },\n`;
              code += `${indent}        new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }\n`;
              code += `${indent}    }\n`;
              code += `${indent}});\n\n`;
            }
            code += generateCSharpElements(child, `"${childName}"`, level + 1, imageMap, commandName);
          }
        }
      }
    }
  }

  return code;
}

// ===== Utilities =====
function sanitizeClassName(name) {
  let cleaned = (name || 'element')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  // CSS класс не может начинаться с цифры или дефиса+цифра
  if (!cleaned || /^[0-9-]/.test(cleaned)) {
    cleaned = 'el_' + cleaned;
  }

  return cleaned || 'element';
}

function toPascalCase(str) {
  return (str || '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function getFillColor(node) {
  // Только корневой фрейм не передает цвет, вложенные фреймы - передают
  const isRootFrame = currentRootFrame && node.id === currentRootFrame.id;
  if (node.type === 'FRAME' && isRootFrame) {
    return '0 0 0 0';
  }

  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const r = fill.color.r;
      const g = fill.color.g;
      const b = fill.color.b;
      const a = (fill.opacity !== undefined ? fill.opacity : 1);
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${a.toFixed(3)}`;
    }
  }
  return '0 0 0 0';
}

function getRGBAColor(node) {
  // Только корневой фрейм не передает цвет, вложенные фреймы - передают
  const isRootFrame = currentRootFrame && node.id === currentRootFrame.id;
  if (node.type === 'FRAME' && isRootFrame) {
    return '0 0 0 0';
  }

  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const r = fill.color.r;
      const g = fill.color.g;
      const b = fill.color.b;
      const nodeOpacity = node.opacity !== undefined ? node.opacity : 1;
      const fillOpacity = fill.opacity !== undefined ? fill.opacity : 1;
      const a = fillOpacity * nodeOpacity;
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${a.toFixed(3)}`;
    }
  }
  return '0 0 0 0';
}

// Получает цвет наложения поверх изображения (первый SOLID fill после изображения)
function getOverlayColor(node) {
  if (!('fills' in node) || !Array.isArray(node.fills) || node.fills.length === 0) {
    return null;
  }

  let foundImage = false;
  for (const fill of node.fills) {
    if (fill.type === 'IMAGE' && fill.imageHash) {
      foundImage = true;
    } else if (foundImage && fill.type === 'SOLID') {
      // Нашли изображение, теперь ищем первый SOLID fill после него
      const r = fill.color.r;
      const g = fill.color.g;
      const b = fill.color.b;
      const a = (fill.opacity !== undefined ? fill.opacity : 1);
      return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${a.toFixed(3)}`;
    }
  }

  return null;
}

function getTextAlign(node) {
  // Map both horizontal and vertical alignment from Figma to Unity TextAnchor
  const h = ('textAlignHorizontal' in node) ? node.textAlignHorizontal : 'CENTER';
  const v = ('textAlignVertical' in node) ? node.textAlignVertical : 'CENTER';

  const mapH = (hh) => {
    if (hh === 'LEFT') return 'Left';
    if (hh === 'RIGHT') return 'Right';
    return 'Center';
  };
  const mapV = (vv) => {
    if (vv === 'TOP') return 'Upper';
    if (vv === 'BOTTOM') return 'Lower';
    return 'Middle';
  };

  return `${mapV(v)}${mapH(h)}`; // e.g., UpperLeft, MiddleCenter, LowerRight
}

function hasImageFill(node, imageMap) {
  // Логируем для Rectangle с потенциальными проблемами
  const isRectangle = node.type === 'RECTANGLE';

  // Сначала пробуем найти через маппинг node.id -> имя файла (самый точный способ)
  if (imageMap.nodeIdToFileName && imageMap.nodeIdToFileName.has(node.id)) {
    const fileName = imageMap.nodeIdToFileName.get(node.id);
    if (imageMap.has(fileName)) {
      if (isRectangle) {
        figma.ui.postMessage({
          type: 'log',
          message: `✅ hasImageFill: Rectangle "${node.name}" найден в imageMap через nodeIdToFileName -> "${fileName}"`
        });
      }
      return true;
    }
  }

  // Проверяем, был ли элемент экспортирован как изображение
  const exportFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`) + '.png';
  if (imageMap.has(exportFileName)) {
    if (isRectangle) {
      figma.ui.postMessage({
        type: 'log',
        message: `✅ hasImageFill: Rectangle "${node.name}" найден в imageMap через exportFileName -> "${exportFileName}"`
      });
    }
    return true;
  }

  // Также проверяем старый формат для обратной совместимости
  const exportHash = `export_${node.id}`;
  if (imageMap.has(exportHash)) {
    if (isRectangle) {
      figma.ui.postMessage({
        type: 'log',
        message: `✅ hasImageFill: Rectangle "${node.name}" найден в imageMap через exportHash`
      });
    }
    return true;
  }

  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        // Пробуем найти через маппинг node.id -> имя файла
        if (imageMap.nodeIdToFileName && imageMap.nodeIdToFileName.has(node.id)) {
          const fileName = imageMap.nodeIdToFileName.get(node.id);
          if (imageMap.has(fileName)) {
            return true;
          }
        }
        // Пробуем найти по имени файла (на основе имени узла)
        const imageFileName = sanitizeFileName(node.name || `image_${fill.imageHash.substring(0, 8)}`) + '.png';
        if (imageMap.has(imageFileName)) {
          return true;
        }
        // Также проверяем старый формат (хеш)
        if (imageMap.has(fill.imageHash)) {
          return true;
        }
        // Пробуем найти через обратный маппинг
        if (imageMap.hashToFileName && imageMap.hashToFileName.has(fill.imageHash)) {
          const fileName = imageMap.hashToFileName.get(fill.imageHash);
          if (imageMap.has(fileName)) {
            return true;
          }
        }
      }
    }
  }

  // Логируем, если Rectangle не найден в imageMap
  if (node.type === 'RECTANGLE') {
    figma.ui.postMessage({
      type: 'log',
      message: `❌ hasImageFill: Rectangle "${node.name}" НЕ найден в imageMap! (nodeId: ${node.id}, exportFileName: ${sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`) + '.png'})`
    });
  }

  return false;
}

function getImageUrl(node, imageMap) {
  // Сначала пробуем найти через маппинг node.id -> имя файла (самый точный способ)
  if (imageMap.nodeIdToFileName && imageMap.nodeIdToFileName.has(node.id)) {
    const fileName = imageMap.nodeIdToFileName.get(node.id);
    if (imageMap.has(fileName)) {
      return imageMap.get(fileName);
    }
  }

  // Сначала проверяем экспортированный элемент по имени файла
  const exportFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`) + '.png';
  if (imageMap.has(exportFileName)) {
    return imageMap.get(exportFileName);
  }

  // Также проверяем старый формат для обратной совместимости
  const exportHash = `export_${node.id}`;
  if (imageMap.has(exportHash)) {
    return imageMap.get(exportHash);
  }

  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        // Пробуем найти через маппинг node.id -> имя файла
        if (imageMap.nodeIdToFileName && imageMap.nodeIdToFileName.has(node.id)) {
          const fileName = imageMap.nodeIdToFileName.get(node.id);
          if (imageMap.has(fileName)) {
            return imageMap.get(fileName);
          }
        }
        // Пробуем найти по имени файла (на основе имени узла)
        const imageFileName = sanitizeFileName(node.name || `image_${fill.imageHash.substring(0, 8)}`) + '.png';
        if (imageMap.has(imageFileName)) {
          return imageMap.get(imageFileName);
        }
        // Также проверяем старый формат (хеш)
        if (imageMap.has(fill.imageHash)) {
          return imageMap.get(fill.imageHash);
        }
        // Пробуем найти через обратный маппинг
        if (imageMap.hashToFileName && imageMap.hashToFileName.has(fill.imageHash)) {
          const fileName = imageMap.hashToFileName.get(fill.imageHash);
          if (imageMap.has(fileName)) {
            return imageMap.get(fileName);
          }
        }
      }
    }
  }
  return null;
}

// Получить имя файла изображения для узла
function getImageFileName(node, imageMap) {
  // Сначала пробуем найти через маппинг node.id -> имя файла (самый точный способ)
  if (imageMap.nodeIdToFileName && imageMap.nodeIdToFileName.has(node.id)) {
    const fileName = imageMap.nodeIdToFileName.get(node.id);
    return fileName.replace('.png', ''); // Возвращаем без расширения для использования в коде
  }

  // Проверяем экспортированный элемент по имени файла
  const exportFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`) + '.png';
  if (imageMap.has(exportFileName)) {
    return exportFileName.replace('.png', ''); // Возвращаем без расширения для использования в коде
  }

  // Старый формат
  const exportHash = `export_${node.id}`;
  if (imageMap.has(exportHash)) {
    // Пробуем найти имя файла через обратный маппинг
    if (imageMap.hashToFileName && imageMap.hashToFileName.has(exportHash)) {
      return imageMap.hashToFileName.get(exportHash).replace('.png', '');
    }
    return sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`);
  }

  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        const imageFileName = sanitizeFileName(node.name || `image_${fill.imageHash.substring(0, 8)}`) + '.png';
        if (imageMap.has(imageFileName)) {
          return imageFileName.replace('.png', '');
        }
        // Старый формат
        if (imageMap.has(fill.imageHash)) {
          // Пробуем найти имя файла через обратный маппинг
          if (imageMap.hashToFileName && imageMap.hashToFileName.has(fill.imageHash)) {
            return imageMap.hashToFileName.get(fill.imageHash).replace('.png', '');
          }
          return sanitizeFileName(node.name || `image_${fill.imageHash.substring(0, 8)}`);
        }
      }
    }
  }
  return null;
}

function sanitizeFileName(name) {
  // Санитизация имени файла из имени узла Figma
  return (name || 'image')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ_\- ]/g, '_') // Заменяем недопустимые символы на подчеркивание
    .replace(/\s+/g, '_') // Заменяем пробелы на подчеркивание
    .replace(/_+/g, '_') // Убираем множественные подчеркивания
    .replace(/^_+|_+$/g, '') // Убираем подчеркивания в начале и конце
    .substring(0, 100) // Ограничиваем длину
    || 'image'; // Если имя пустое, используем 'image'
}

// Получить уникальное имя файла с учетом уже использованных имен
function getUniqueFileName(baseName, usedFileNames) {
  let fileName = baseName;
  let counter = 1;
  while (usedFileNames.has(fileName)) {
    fileName = `${baseName}_${counter}`;
    counter++;
  }
  usedFileNames.add(fileName);
  return fileName;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// Получить все родительские фреймы с clipsContent === true для узла (от ближайшего к дальнему)
function getClippingFrames(node, rootFrame) {
  const clippingFrames = [];
  let current = node.parent;

  while (current && current !== rootFrame) {
    if (current.type === 'FRAME' && current.clipsContent === true) {
      clippingFrames.unshift(current); // Добавляем в начало, чтобы порядок был от ближайшего к дальнему
    }
    current = current.parent;
  }

  return clippingFrames;
}

// Проверить, виден ли элемент внутри родительских фреймов с clipsContent
// Возвращает true если элемент хотя бы частично виден (пересекается с фреймом)
function isElementVisibleInClippingFrames(node, rootFrame) {
  const clippingFrames = getClippingFrames(node, rootFrame);

  if (clippingFrames.length === 0) {
    return true; // Нет фреймов с обрезкой - элемент виден
  }

  const nodeBounds = getAbsoluteBounds(node);

  // Проверяем каждый фрейм с обрезкой от ближайшего к дальнему
  for (const frame of clippingFrames) {
    const frameBounds = getAbsoluteBounds(frame);

    // Вычисляем границы фрейма и элемента в абсолютных координатах Figma
    const frameLeftX = frameBounds.x;
    const frameRightX = frameBounds.x + frameBounds.width;
    const frameTopY = frameBounds.y;
    const frameBottomY = frameBounds.y + frameBounds.height;

    const nodeLeftX = nodeBounds.x;
    const nodeRightX = nodeBounds.x + nodeBounds.width;
    const nodeTopY = nodeBounds.y;
    const nodeBottomY = nodeBounds.y + nodeBounds.height;

    // Проверяем пересечение: элемент должен ХОТЯ БЫ ЧАСТИЧНО пересекаться с фреймом
    // Пересечение по X: правый край элемента правее левого края фрейма И левый край элемента левее правого края фрейма
    const intersectsX = nodeRightX > frameLeftX && nodeLeftX < frameRightX;
    // Пересечение по Y: нижний край элемента ниже верхнего края фрейма И верхний край элемента выше нижнего края фрейма
    const intersectsY = nodeBottomY > frameTopY && nodeTopY < frameBottomY;

    if (!intersectsX || !intersectsY) {
      // Элемент ПОЛНОСТЬЮ не пересекается с фреймом - полностью невидим
      // НЕ логируем это для каждого элемента, т.к. это нормальная ситуация
      return false;
    }

    // Если элемент хотя бы частично пересекается - он будет перенесен с обрезанными координатами
  }

  return true; // Элемент хотя бы частично виден во всех фреймах
}

// Обрезать координаты элемента относительно родительских фреймов с clipsContent
function clipCoordinatesToFrames(node, rootFrame, coords) {
  const clippingFrames = getClippingFrames(node, rootFrame);

  if (clippingFrames.length === 0) {
    return coords;
  }

  const rfBounds = getAbsoluteBounds(rootFrame);

  let minX = coords.minX;
  let minY = coords.minY;
  let maxX = coords.maxX;
  let maxY = coords.maxY;

  // Обрабатываем каждый фрейм с обрезкой от ближайшего к дальнему
  for (const frame of clippingFrames) {
    const frameBounds = getAbsoluteBounds(frame);

    // Вычисляем границы фрейма относительно rootFrame
    const frameLeftX = frameBounds.x - rfBounds.x;
    const frameTopY = frameBounds.y - rfBounds.y;
    const frameRightX = frameLeftX + frameBounds.width;
    const frameBottomY = frameTopY + frameBounds.height;

    // Конвертируем в координаты Unity (Y инвертирован)
    const frameBottomY_unity = rootFrame.height - frameBottomY;
    const frameTopY_unity = rootFrame.height - frameTopY;

    // Обрезаем координаты элемента границами фрейма
    const clippedMinX = Math.max(minX, frameLeftX);
    const clippedMinY = Math.max(minY, frameBottomY_unity);
    const clippedMaxX = Math.min(maxX, frameRightX);
    const clippedMaxY = Math.min(maxY, frameTopY_unity);

    // Если элемент полностью вне фрейма, возвращаем пустые координаты
    if (clippedMinX >= clippedMaxX || clippedMinY >= clippedMaxY) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    // Обновляем координаты для следующей итерации
    minX = clippedMinX;
    minY = clippedMinY;
    maxX = clippedMaxX;
    maxY = clippedMaxY;
  }

  return {
    minX: Math.round(minX),
    minY: Math.round(minY),
    maxX: Math.round(maxX),
    maxY: Math.round(maxY)
  };
}

// Absolute bounds in Figma document coordinates
function getAbsoluteBounds(node) {
  if (!('absoluteTransform' in node) || !('width' in node) || !('height' in node)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const t = node.absoluteTransform; // [[a, c, e], [b, d, f]]
  const a = t[0][0];
  const c = t[0][1];
  const e = t[0][2];
  const b = t[1][0];
  const d = t[1][1];
  const f = t[1][2];

  const w = node.width || 0;
  const h = node.height || 0;

  function transformPoint(px, py) { return { x: a * px + c * py + e, y: b * px + d * py + f }; }

  const p0 = transformPoint(0, 0);
  const p1 = transformPoint(w, 0);
  const p2 = transformPoint(0, h);
  const p3 = transformPoint(w, h);

  const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
  const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
  const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
  const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

async function dumpSelectionDebug() {
  const node = figma.currentPage.selection[0];
  if (!node || node.type !== 'FRAME') {
    figma.ui.postMessage({ type: 'error', message: '❌ Debug: выберите корневой Frame' });
    return;
  }
  const root = currentRootFrame || getRootFrameFallback(node);
  const rb = getAbsoluteBounds(root);
  figma.ui.postMessage({ type: 'log', message: `📐 Root: size=${Math.round(root.width)}x${Math.round(root.height)} abs=(${rb.x.toFixed(1)},${rb.y.toFixed(1)}) ${rb.width.toFixed(1)}x${rb.height.toFixed(1)}` });
  const kids = 'children' in node ? node.children : [];
  figma.ui.postMessage({ type: 'log', message: `👶 Children: ${kids.length}` });
  const limit = Math.min(kids.length, 100);
  for (let i = 0; i < limit; i++) {
    const ch = kids[i];
    const nrm = calculateNormalizedAnchors(ch);
    const line = `#${i} ${ch.name || ch.id} type=${ch.type} size=${'width' in ch ? Math.round(ch.width) : 0}x${'height' in ch ? Math.round(ch.height) : 0} anchors=[${nrm.min}..${nrm.max}]`;
    figma.ui.postMessage({ type: 'log', message: line });
  }
}

// Normalized anchors relative to root frame (0..1 from left/bottom)
function calculateNormalizedAnchors(node) {
  const rootFrame = currentRootFrame || getRootFrameFallback(node);
  if (!rootFrame || !('width' in rootFrame) || !('height' in rootFrame)) {
    return { min: '0.5 0.5', max: '0.5 0.5' };
  }

  // Используем calculatePixelCoordinates для получения обрезанных координат
  const px = calculatePixelCoordinates(node);

  const minX = clamp01(px.minX / rootFrame.width).toFixed(4);
  const minY = clamp01(px.minY / rootFrame.height).toFixed(4);
  const maxX = clamp01(px.maxX / rootFrame.width).toFixed(4);
  const maxY = clamp01(px.maxY / rootFrame.height).toFixed(4);

  return { min: `${minX} ${minY}`, max: `${maxX} ${maxY}` };
}

// NEW APPROACH: Calculate pixel coordinates instead of normalized anchors
function calculatePixelCoordinates(node) {
  const rootFrame = currentRootFrame || getRootFrameFallback(node);
  if (!rootFrame || !('width' in rootFrame) || !('height' in rootFrame)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  const rfBounds = getAbsoluteBounds(rootFrame);
  const b = getAbsoluteBounds(node);

  const nodeWidth = b.width || 0;
  const nodeHeight = b.height || 0;

  const leftX_figma = b.x - rfBounds.x;
  const rightX_figma = leftX_figma + nodeWidth;

  const topY_figma = b.y - rfBounds.y;
  const bottomY_figma = topY_figma + nodeHeight;

  // Convert Y coordinates from Figma (top-down) to Unity (bottom-up)
  const bottomY_unity = rootFrame.height - bottomY_figma;
  const topY_unity = rootFrame.height - topY_figma;

  // Return pixel coordinates
  const coords = {
    minX: Math.round(leftX_figma),
    minY: Math.round(bottomY_unity),
    maxX: Math.round(rightX_figma),
    maxY: Math.round(topY_unity)
  };

  // Применяем обрезку от родительских фреймов с clipsContent
  return clipCoordinatesToFrames(node, rootFrame, coords);
}

function calculateOffsetMin(node) { return '0 0'; }
function calculateOffsetMax(node) { return '0 0'; }

// Escape helper
function escapeCSharpString(s) {
  // Harden against Unicode line/paragraph separators that break C# lexer
  return (s || '')
    .replace(/\\/g, '\\\\')                // escape backslashes
    .replace(/"/g, '\\"')                   // escape quotes
    .replace(/[\r\n\u2028\u2029\u0085\u000B\u000C]/g, ' ') // normalize all line breaks/control separators
    .replace(/\t/g, ' ')                       // tabs to spaces
    .replace(/\s{2,}/g, ' ')                   // collapse multi-spaces
    .trim();
}

// Проверка, содержит ли узел текстовые элементы
function hasTextInside(node, depth = 0) {
  // Ограничение глубины рекурсии
  if (depth > 10) return false;

  // Если это текстовый элемент - возвращаем true
  if (node.type === 'TEXT') {
    return true;
  }

  // Рекурсивно проверяем дочерние элементы
  if ('children' in node && node.children) {
    for (const child of node.children) {
      if (hasTextInside(child, depth + 1)) {
        return true;
      }
    }
  }

  return false;
}

// Проверка, содержит ли группа вложенные группы (на первом уровне дочерних элементов)
function hasNestedGroup(node, depth = 0) {
  // Проверяем только контейнеры
  if (node.type !== 'GROUP' && node.type !== 'FRAME' &&
    node.type !== 'COMPONENT' && node.type !== 'INSTANCE') {
    return false;
  }

  // Проверяем дочерние элементы на наличие групп
  if ('children' in node && node.children) {
    for (const child of node.children) {
      // Если нашли группу среди дочерних элементов - это вложенная группа
      if (child.type === 'GROUP' || child.type === 'FRAME' ||
        child.type === 'COMPONENT' || child.type === 'INSTANCE') {
        try {
          figma.ui.postMessage({
            type: 'log',
            message: `🎯 Найдена вложенная группа: "${child.name}" внутри "${node.name}" (глубина: ${depth})`
          });
        } catch (e) { }
        return true;
      }
    }
  }

  return false;
}

// Функция проверки, нужно ли экспортировать элемент как изображение
function shouldExportAsImage(node) {
  // Текстовые элементы не экспортируются как изображения
  if (node.type === 'TEXT') {
    return false;
  }

  // Логируем все Rectangle и VECTOR для отладки
  if (node.type === 'RECTANGLE' || node.type === 'VECTOR') {
    const hasCornerRadius = 'cornerRadius' in node;
    const cornerType = hasCornerRadius ? typeof node.cornerRadius : 'отсутствует';
    let cornerValue = 'N/A';
    if (hasCornerRadius) {
      if (typeof node.cornerRadius === 'symbol' || node.cornerRadius === figma.mixed) {
        cornerValue = 'MIXED';
      } else if (typeof node.cornerRadius === 'number') {
        cornerValue = node.cornerRadius.toString();
      } else {
        cornerValue = String(cornerType);
      }
    }
    figma.ui.postMessage({
      type: 'log',
      message: `🔍 shouldExportAsImage вызвана для ${node.type} "${node.name}" (hasCornerRadius=${hasCornerRadius}, type=${cornerType}, value=${cornerValue})`
    });
  }

  // Проверяем, поддерживает ли узел экспорт
  if (!('exportAsync' in node)) {
    if (node.type === 'RECTANGLE' || node.type === 'VECTOR') {
      figma.ui.postMessage({
        type: 'log',
        message: `❌ ${node.type} "${node.name}" НЕ поддерживает exportAsync!`
      });
    }
    return false;
  }

  // ВАЖНО: НЕ пропускаем невидимые элементы с эффектами!
  // Элементы с эффектами (тени, свечение) должны экспортироваться даже если они скрыты,
  // так как их эффекты могут быть видны
  const hasEffects = node.effects && Array.isArray(node.effects) && node.effects.length > 0;

  // ВАЖНО: НЕ пропускаем невидимые элементы!
  // Они должны экспортироваться, так как пользователь может включить их в игре
  // Пропускаем только элементы с opacity = 0
  if (!hasEffects) {
    try { if (typeof node.opacity === 'number' && node.opacity <= 0) return false; } catch (_) { }
  }

  const nodeName = (node.name || '').toLowerCase();

  // 0. GROUP, FRAME, COMPONENT, INSTANCE НЕ экспортируются целиком как изображение
  // Они обрабатываются как контейнеры, их содержимое экспортируется отдельно
  if (node.type === 'GROUP' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    return false;
  }

  // 0.1. LINE, STAR, POLYGON элементы - всегда экспортируем как изображение
  if (node.type === 'LINE') {
    figma.ui.postMessage({
      type: 'log',
      message: `✅ LINE "${node.name}" будет экспортирован как изображение`
    });
    return "Line element";
  }

  if (node.type === 'STAR') {
    figma.ui.postMessage({
      type: 'log',
      message: `✅ STAR "${node.name}" будет экспортирован как изображение`
    });
    return "Star element";
  }

  if (node.type === 'POLYGON') {
    figma.ui.postMessage({
      type: 'log',
      message: `✅ POLYGON "${node.name}" будет экспортирован как изображение`
    });
    return "Polygon element";
  }

  // 0.5. Boolean операции (Subtract, Union, Intersect, Exclude)
  if (node.type === 'BOOLEAN_OPERATION') {
    const operationType = node.booleanOperation || 'unknown';
    const operationName = {
      'UNION': 'Union',
      'SUBTRACT': 'Subtract',
      'INTERSECT': 'Intersect',
      'EXCLUDE': 'Exclude'
    }[operationType] || operationType;

    figma.ui.postMessage({
      type: 'log',
      message: `✅ BOOLEAN_OPERATION "${node.name}" (${operationName}) будет экспортирован как изображение`
    });
    return `Boolean operation (${operationName})`;
  }

  // 1. Векторы по названию ИЛИ по типу VECTOR
  if (nodeName.includes('vector') || nodeName.includes('вектор')) {
    figma.ui.postMessage({
      type: 'log',
      message: `✅ "${node.name}" будет экспортирован (содержит 'vector' в названии)`
    });
    return true;
  }

  // VECTOR без "vector" в названии - логируем и пропускаем (если нет других причин)
  if (node.type === 'VECTOR') {
    figma.ui.postMessage({
      type: 'log',
      message: `⚠️ VECTOR "${node.name}" НЕ содержит 'vector' в названии. Проверяю другие критерии...`
    });
  }

  // 2. RECTANGLE или VECTOR с закругленными углами
  // ВАЖНО: VECTOR тоже могут иметь cornerRadius (когда они созданы из Rectangle)
  if (node.type === 'RECTANGLE' || node.type === 'VECTOR') {
    // Проверяем наличие cornerRadius свойства
    if (!('cornerRadius' in node)) {
      // Если у VECTOR нет cornerRadius - это обычный вектор
      // НЕ экспортируем его автоматически, проверяем другие критерии (градиенты, эффекты)
      if (node.type === 'VECTOR') {
        figma.ui.postMessage({
          type: 'log',
          message: `⚠️ VECTOR "${node.name}" без cornerRadius - проверяю другие критерии (градиенты, эффекты)`
        });
      }
      // Rectangle без cornerRadius - пропускаем проверку
    } else {
      // Export rectangles/vectors with rounded corners as images, because C# doesn't support this directly.
      if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
        figma.ui.postMessage({
          type: 'log',
          message: `✅ ${node.type} "${node.name}" будет экспортирован как изображение (cornerRadius=${node.cornerRadius})`
        });
        return `${node.type} with rounded corners`;
      } else if (typeof node.cornerRadius === 'symbol' || node.cornerRadius === figma.mixed) {
        // If cornerRadius is a symbol or figma.mixed, it means the corners have different radii.
        // We should check each corner individually.
        const tl = node.topLeftRadius || 0;
        const tr = node.topRightRadius || 0;
        const bl = node.bottomLeftRadius || 0;
        const br = node.bottomRightRadius || 0;

        figma.ui.postMessage({
          type: 'log',
          message: `🔵 ${node.type} "${node.name}" имеет MIXED cornerRadius: TL=${tl}, TR=${tr}, BL=${bl}, BR=${br}`
        });

        // Проверяем, есть ли хотя бы одно закругление
        const hasRounding = tl > 0 || tr > 0 || bl > 0 || br > 0;

        if (hasRounding) {
          figma.ui.postMessage({
            type: 'log',
            message: `✅ ${node.type} "${node.name}" будет экспортирован как изображение (MIXED cornerRadius с закруглениями)`
          });
          return `${node.type} with mixed rounded corners`;
        } else {
          // MIXED cornerRadius с углами = 0
          // Для VECTOR это означает сложную форму (скосы, параллелограмм и т.д.)
          // Для RECTANGLE - это баг Figma, не экспортируем
          if (node.type === 'VECTOR') {
            figma.ui.postMessage({
              type: 'log',
              message: `✅ VECTOR "${node.name}" будет экспортирован как изображение (MIXED cornerRadius = сложная форма)`
            });
            return "Vector with mixed cornerRadius (complex shape)";
          } else {
            figma.ui.postMessage({
              type: 'log',
              message: `⚠️ ${node.type} "${node.name}" имеет MIXED cornerRadius, но все углы = 0. НЕ экспортируется как изображение!`
            });
          }
        }
      } else if (typeof node.cornerRadius === 'number' && node.cornerRadius === 0) {
        // cornerRadius = 0 - это простой прямоугольник без закруглений
        // НЕ экспортируем ни VECTOR, ни RECTANGLE
        figma.ui.postMessage({
          type: 'log',
          message: `⚠️ ${node.type} "${node.name}" cornerRadius = 0, это простой прямоугольник - НЕ экспортируется как изображение`
        });
      } else {
        figma.ui.postMessage({
          type: 'log',
          message: `🔵 ${node.type} "${node.name}" cornerRadius type: ${typeof node.cornerRadius}`
        });
      }
    }
  }

  // 3. TEXT с градиентом - ОТКЛЮЧЕНО! Текст всегда остается текстом
  // Unity не поддерживает градиенты на тексте, но это не повод экспортировать как изображение
  // if (node.type === 'TEXT' && 'fills' in node && Array.isArray(node.fills)) {
  //   for (const fill of node.fills) {
  //     if (fill.type === 'GRADIENT_LINEAR' || 
  //         fill.type === 'GRADIENT_RADIAL' || 
  //         fill.type === 'GRADIENT_ANGULAR' || 
  //         fill.type === 'GRADIENT_DIAMOND') {
  //       return true;
  //     }
  //   }
  // }

  // 4. Любой элемент с градиентом
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'GRADIENT_LINEAR' ||
        fill.type === 'GRADIENT_RADIAL' ||
        fill.type === 'GRADIENT_ANGULAR' ||
        fill.type === 'GRADIENT_DIAMOND') {
        return true;
      }
    }
  }

  // 5. Элементы с изображениями в fills + наложения (цветовые overlay)
  // Если у элемента есть изображение И другие fill слои (цвета, градиенты) - экспортируем весь элемент
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 1) {
    let hasImage = false;
    let hasOtherFills = false;

    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        hasImage = true;
      } else if (fill.type === 'SOLID' ||
        fill.type === 'GRADIENT_LINEAR' ||
        fill.type === 'GRADIENT_RADIAL' ||
        fill.type === 'GRADIENT_ANGULAR' ||
        fill.type === 'GRADIENT_DIAMOND') {
        hasOtherFills = true;
      }
    }

    // Если есть изображение И другие fill слои - экспортируем весь элемент как изображение
    // Это гарантирует, что все наложения будут сохранены
    if (hasImage && hasOtherFills) {
      return true;
    }
  }

  // 5b. Элементы с изображениями и эффектами
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        // Если есть изображение с эффектами - тоже экспортируем
        if (hasEffects) {
          return true;
        }
      }
    }
  }

  // 6. Элементы с эффектами (тени, размытие и т.д.)
  // ВАЖНО: Экспортируем даже если элемент скрыт!
  if (hasEffects) {
    return true;
  }

  // НЕ экспортируем простые прямоугольники с цветом - они должны использовать цвет напрямую
  // Простые прямоугольники без закругленных углов, градиентов и эффектов обрабатываются через цвет
  return false;
}

// ===== Image Upload to API =====
async function uploadAllImages(root, token) {
  const hashes = new Set();
  const exportNodes = []; // Узлы для экспорта как изображение
  const processedNodes = new Set(); // Для отслеживания уже обработанных узлов
  const hashToNodeMap = new Map(); // Связь между хешем изображения и узлом, который его использует

  // Рекурсивная функция сбора всех изображений и элементов для экспорта
  const collect = (n) => {
    // Пропускаем уже обработанные узлы (защита от циклических ссылок)
    if (processedNodes.has(n.id)) {
      return;
    }
    processedNodes.add(n.id);

    // Проверяем, есть ли у элемента эффекты (тени, свечение)
    const hasEffects = n.effects && Array.isArray(n.effects) && n.effects.length > 0;

    // НЕ пропускаем невидимые элементы - они должны переноситься!
    // Пропускаем только элементы с opacity = 0
    try {
      if (typeof n.opacity === 'number' && n.opacity <= 0 && !hasEffects) {
        // Продолжаем обход дочерних элементов
        if ('children' in n && Array.isArray(n.children)) {
          for (const child of n.children) {
            collect(child);
          }
        }
        return;
      }
    } catch (_) { }

    // Проверяем, нужно ли экспортировать как изображение
    const exportResult = shouldExportAsImage(n);
    if (exportResult) {
      exportNodes.push(n);
      // Логируем только важные элементы (не все RECTANGLE/VECTOR)
      const exportResultStr = typeof exportResult === 'string' ? exportResult : '';
      const isImportant = exportResultStr.includes('Group') ||
        exportResultStr.includes('Mask') ||
        exportResultStr.includes('Boolean') ||
        exportResultStr.includes('Line') ||
        n.type === 'BOOLEAN_OPERATION' ||
        n.type === 'LINE';
      if (exportNodes.length % 10 === 0 || isImportant) {
        const nodeName = n.name || 'Unnamed';
        const visibilityNote = n.visible === false ? ' (СКРЫТ, но с эффектами)' : '';
        const typeNote = n.type === 'BOOLEAN_OPERATION' ? ' [BOOLEAN]' : (n.type === 'LINE' ? ' [LINE]' : '');
        figma.ui.postMessage({ type: 'log', message: `📸 Найдено элементов для экспорта: ${exportNodes.length} (последний: ${nodeName}${typeNote}${visibilityNote})` });
      }

      // ВАЖНО: Если элемент экспортируется целиком (Boolean, Line и т.д.),
      // НЕ обрабатываем его дочерние элементы рекурсивно!
      const shouldSkipChildren = n.type === 'BOOLEAN_OPERATION' ||
        n.type === 'LINE' ||
        n.type === 'STAR' ||
        n.type === 'POLYGON';

      if (shouldSkipChildren) {
        // Пропускаем дочерние элементы - они включены в экспорт родителя
        return;
      }
    }

    // Собираем изображения из fills и связываем их с узлом
    if ('fills' in n && Array.isArray(n.fills)) {
      for (const f of n.fills) {
        if (f.type === 'IMAGE' && f.imageHash) {
          hashes.add(f.imageHash);
          // Сохраняем связь между хешем и узлом для последующего именования
          if (!hashToNodeMap.has(f.imageHash)) {
            hashToNodeMap.set(f.imageHash, n);
          }
        }
      }
    }

    // Рекурсивно обрабатываем все дочерние элементы (включая элементы внутри фреймов)
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) {
        collect(child);
      }
    }
  };

  // Начинаем сбор с корневого узла
  figma.ui.postMessage({ type: 'log', message: `🔍 Начинаю сбор изображений из: ${root.name || root.id}` });
  collect(root);

  figma.ui.postMessage({ type: 'log', message: `📊 Найдено: ${hashes.size} изображений, ${exportNodes.length} элементов для экспорта` });

  const emptyMap = new Map();

  // Если нет ни изображений, ни элементов для экспорта
  if (!hashes.size && !exportNodes.length) {
    figma.ui.postMessage({ type: 'log', message: '🖼️ Изображений для загрузки не найдено' });
    return emptyMap;
  }

  // В режиме Data загрузка на API не требуется
  if (currentAssetMode !== 'data' && (!token || !token.trim())) {
    figma.ui.postMessage({ type: 'log', message: `⚠️ Токен не задан — пропускаю загрузку изображений (${hashes.size + exportNodes.length})` });
  }

  // Собираем байты изображений и отправляем в UI для загрузки (там доступен Blob/FormData)
  const imagesPayload = [];
  const nameToHashMap = new Map(); // Маппинг имени файла -> оригинальный ключ (hash или export_id)
  const nodeIdToFileNameMap = new Map(); // Маппинг node.id -> имя файла для точного поиска
  const usedFileNames = new Set(); // Для отслеживания уже использованных имен файлов

  // Добавляем обычные изображения с именами из Figma (батчами)
  const IMAGE_BATCH_SIZE = 10;
  const hashArray = Array.from(hashes);

  for (let i = 0; i < hashArray.length; i += IMAGE_BATCH_SIZE) {
    const batch = hashArray.slice(i, i + IMAGE_BATCH_SIZE);
    const batchNum = Math.floor(i / IMAGE_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(hashArray.length / IMAGE_BATCH_SIZE);

    if (hashArray.length > IMAGE_BATCH_SIZE) {
      figma.ui.postMessage({ type: 'log', message: `📥 Загрузка изображений батч ${batchNum}/${totalBatches}...` });
    }

    for (const hash of batch) {
      try {
        const image = figma.getImageByHash(hash);
        if (!image) {
          figma.ui.postMessage({ type: 'error', message: `❌ Нет изображения для hash=${hash}` });
          continue;
        }
        const bytes = await image.getBytesAsync();
        const node = hashToNodeMap.get(hash);
        const baseFileName = sanitizeFileName(node ? (node.name || `image_${hash.substring(0, 8)}`) : `image_${hash.substring(0, 8)}`);
        const fileName = getUniqueFileName(baseFileName, usedFileNames);
        const finalFileName = `${fileName}.png`;
        imagesPayload.push({ hash, bytes: Array.from(bytes), filename: finalFileName, mime: 'image/png', originalHash: hash });
        nameToHashMap.set(finalFileName, hash);
        if (node) {
          nodeIdToFileNameMap.set(node.id, finalFileName);
        }
      } catch (err) {
        figma.ui.postMessage({ type: 'error', message: `❌ Сбой подготовки изображения hash=${hash.substring(0, 8)}...: ${err.message}` });
      }
    }

    // Задержка между батчами
    if (i + IMAGE_BATCH_SIZE < hashArray.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Экспортируем специальные узлы как PNG с именами из Figma (батчами для оптимизации памяти)
  const EXPORT_BATCH_SIZE = 5; // Обрабатываем по 5 изображений за раз
  const EXPORT_DELAY_MS = 100; // Задержка между батчами для освобождения памяти

  for (let exportIdx = 0; exportIdx < exportNodes.length; exportIdx += EXPORT_BATCH_SIZE) {
    const batch = exportNodes.slice(exportIdx, exportIdx + EXPORT_BATCH_SIZE);
    const batchNum = Math.floor(exportIdx / EXPORT_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(exportNodes.length / EXPORT_BATCH_SIZE);

    figma.ui.postMessage({ type: 'log', message: `📦 Обработка батча ${batchNum}/${totalBatches} (${batch.length} элементов)...` });

    for (let batchNodeIdx = 0; batchNodeIdx < batch.length; batchNodeIdx++) {
      const node = batch[batchNodeIdx];
      const globalNodeIdx = exportIdx + batchNodeIdx;

      try {
        // Группы больше не обрабатываются специальным образом
        const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });

        const baseFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`);
        const fileName = getUniqueFileName(baseFileName, usedFileNames);
        const finalFileName = `${fileName}.png`;
        const exportKey = `export_${node.id}`;

        // Конвертируем bytes в массив только при необходимости
        const bytesArray = Array.from(bytes);
        imagesPayload.push({ hash: exportKey, bytes: bytesArray, filename: finalFileName, mime: 'image/png', originalHash: exportKey });
        nameToHashMap.set(finalFileName, exportKey);
        nodeIdToFileNameMap.set(node.id, finalFileName);

        // Логируем только каждое 10-е изображение
        if (globalNodeIdx % 10 === 0) {
          figma.ui.postMessage({ type: 'log', message: `✅ Экспортировано: ${finalFileName} (${imagesPayload.length}/${exportNodes.length})` });
        }
      } catch (err) {
        figma.ui.postMessage({ type: 'error', message: `❌ Сбой экспорта элемента ${node.name || node.id}: ${err.message}` });
      }
    }

    // Задержка между батчами для освобождения памяти
    if (exportIdx + EXPORT_BATCH_SIZE < exportNodes.length) {
      await new Promise(resolve => setTimeout(resolve, EXPORT_DELAY_MS));
    }
  }

  // Кешируем в UI для последующей упаковки в ZIP (отправляем все сразу, но после батчинга экспорта)
  figma.ui.postMessage({ type: 'cache-images', images: imagesPayload });
  if (currentAssetMode !== 'data' && token && token.trim()) {
    figma.ui.postMessage({ type: 'upload-images', images: imagesPayload, token });
    figma.ui.postMessage({ type: 'log', message: `🔄 Передано в UI для загрузки: ${imagesPayload.length}` });
  }

  // Ждём ответ от UI с результатами загрузки
  if (currentAssetMode !== 'data' && token && token.trim()) {
    const resultMap = await new Promise((resolve) => { pendingUploadResolve = resolve; });
    // Преобразуем результат: создаем новый маппинг с именами файлов вместо хешей
    const nameBasedMap = new Map();
    const hashToFileNameMap = new Map(); // Обратный маппинг: hash/export_id -> имя файла

    // Создаем обратный маппинг
    for (const [fileName, originalKey] of nameToHashMap.entries()) {
      hashToFileNameMap.set(originalKey, fileName);
    }

    if (resultMap) {
      // Сначала добавляем по именам файлов
      for (const [key, value] of resultMap.entries()) {
        // Если ключ уже имя файла, добавляем как есть
        if (key.endsWith('.png')) {
          nameBasedMap.set(key, value);
        } else {
          // Иначе ищем имя файла по хешу/ID
          const fileName = hashToFileNameMap.get(key);
          if (fileName) {
            nameBasedMap.set(fileName, value);
            // Также добавляем по старому ключу для обратной совместимости
            nameBasedMap.set(key, value);
          } else {
            nameBasedMap.set(key, value);
          }
        }
      }
    }

    // Добавляем обратный маппинг в imageMap для поиска по хешам
    nameBasedMap.hashToFileName = hashToFileNameMap;
    nameBasedMap.nodeIdToFileName = nodeIdToFileNameMap;
    return nameBasedMap;
  } else {
    // Вернем карту-заглушку с именами файлов
    const placeholder = new Map();
    const hashToFileNameMap = new Map();
    const finalNodeIdToFileNameMap = new Map();
    const usedFileNamesForData = new Set(); // Отдельный Set для режима data

    for (const hash of hashes) {
      const node = hashToNodeMap.get(hash);
      const baseFileName = sanitizeFileName(node ? (node.name || `image_${hash.substring(0, 8)}`) : `image_${hash.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNamesForData);
      const fullFileName = `${fileName}.png`;
      placeholder.set(fullFileName, 'data');
      placeholder.set(hash, 'data'); // Для обратной совместимости
      hashToFileNameMap.set(hash, fullFileName);
      if (node) {
        finalNodeIdToFileNameMap.set(node.id, fullFileName);
      }
    }
    for (const node of exportNodes) {
      const baseFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNamesForData);
      const fullFileName = `${fileName}.png`;
      const exportKey = `export_${node.id}`;
      placeholder.set(fullFileName, 'data');
      placeholder.set(exportKey, 'data'); // Для обратной совместимости
      hashToFileNameMap.set(exportKey, fullFileName);
      finalNodeIdToFileNameMap.set(node.id, fullFileName);
    }

    placeholder.hashToFileName = hashToFileNameMap;
    placeholder.nodeIdToFileName = finalNodeIdToFileNameMap;
    return placeholder;
  }
}

// Инициализация токена при открытии UI
figma.clientStorage.getAsync('apiToken').then((saved) => {
  currentApiToken = saved || '';
  figma.ui.postMessage({ type: 'init', token: currentApiToken });
});


// ===== HTML PAGE GENERATION =====
// ===== TEXT TO UPPERCASE =====
async function convertSelectedTextToUppercase() {
  figma.ui.postMessage({ type: 'log', message: '🔤 Начинаю преобразование текста в CAPS LOCK...' });

  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'error', message: 'Выберите хотя бы один элемент' });
    figma.notify('Выберите хотя бы один элемент');
    return;
  }

  let textCount = 0;
  const textNodes = [];

  // Рекурсивная функция для сбора всех текстовых элементов
  function collectTextNodes(node) {
    if (node.type === 'TEXT') {
      textNodes.push(node);
    }

    // Рекурсивно обрабатываем дочерние элементы
    if ('children' in node) {
      for (const child of node.children) {
        collectTextNodes(child);
      }
    }
  }

  // Собираем все текстовые элементы
  for (const node of selection) {
    collectTextNodes(node);
  }

  // Обрабатываем каждый текстовый элемент
  for (const textNode of textNodes) {
    try {
      // Загружаем шрифт перед изменением текста
      await figma.loadFontAsync(textNode.fontName);
      textNode.characters = textNode.characters.toUpperCase();
      textCount++;
      figma.ui.postMessage({ type: 'log', message: `✅ "${textNode.name}": ${textNode.characters}` });
    } catch (e) {
      figma.ui.postMessage({ type: 'log', message: `⚠️ Ошибка обработки текста "${textNode.name}": ${e.message}` });
    }
  }

  figma.ui.postMessage({ type: 'log', message: `✅ Преобразовано текстовых элементов: ${textCount}` });
  figma.notify(`✅ Преобразовано текстовых элементов: ${textCount}`);
}

// Выравнивание текста по размерам Rectangle
async function alignTextToRectangles() {
  figma.ui.postMessage({ type: 'log', message: '📐 Начинаю выравнивание текста по Rectangle...' });

  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'error', message: 'Выберите элементы (Rectangle + Text или группы с ними)' });
    figma.notify('Выберите элементы');
    return;
  }

  figma.ui.postMessage({ type: 'log', message: `📦 Выбрано элементов: ${selection.length}` });

  let totalRectangles = 0;
  let totalTexts = 0;
  let alignedCount = 0;

  // Функция для поиска элементов-подложек (Rectangle, Frame, Component и т.д.) и Text в узле
  function findBackgroundAndText(node) {
    const backgrounds = []; // Любые элементы, которые могут быть подложкой
    const texts = [];

    function collect(n) {
      // Подложкой может быть: Rectangle, Frame, Component, Instance, Vector, Ellipse и т.д.
      if (n.type === 'RECTANGLE' || n.type === 'FRAME' || n.type === 'COMPONENT' ||
        n.type === 'INSTANCE' || n.type === 'VECTOR' || n.type === 'ELLIPSE' ||
        n.type === 'POLYGON' || n.type === 'STAR' || n.type === 'LINE') {
        backgrounds.push(n);
      } else if (n.type === 'TEXT') {
        texts.push(n);
      }

      if ('children' in n) {
        for (const child of n.children) {
          collect(child);
        }
      }
    }

    collect(node);
    return { backgrounds, texts };
  }

  // Новая логика: ищем текст и его ближайший фоновый элемент (родитель или сосед)
  function findBackgroundForText(textNode) {
    // Проверяем родителя текста
    if (textNode.parent && textNode.parent.type !== 'PAGE') {
      const parent = textNode.parent;

      // Если родитель - подходящий фоновый элемент
      if (parent.type === 'FRAME' || parent.type === 'COMPONENT' || parent.type === 'INSTANCE') {
        return parent;
      }

      // Ищем соседей текста (другие дети того же родителя)
      if ('children' in parent) {
        for (const sibling of parent.children) {
          if (sibling.id !== textNode.id &&
            (sibling.type === 'RECTANGLE' || sibling.type === 'FRAME' ||
              sibling.type === 'VECTOR' || sibling.type === 'ELLIPSE' ||
              sibling.type === 'POLYGON' || sibling.type === 'STAR')) {
            return sibling;
          }
        }
      }
    }

    return null;
  }

  // Обрабатываем каждый выбранный элемент
  for (const node of selection) {
    // Собираем все тексты из выбранного элемента
    const allTexts = [];

    function collectTexts(n) {
      if (n.type === 'TEXT') {
        allTexts.push(n);
      }
      if ('children' in n) {
        for (const child of n.children) {
          collectTexts(child);
        }
      }
    }

    collectTexts(node);
    totalTexts += allTexts.length;

    figma.ui.postMessage({
      type: 'log',
      message: `🔍 "${node.name}" (${node.type}): найдено текстов: ${allTexts.length}`
    });

    // Для каждого текста ищем его ближайший фоновый элемент
    for (const text of allTexts) {
      const bgElement = findBackgroundForText(text);

      if (bgElement) {
        try {
          totalRectangles++;

          // Выравниваем текст по размеру его фонового элемента
          text.x = bgElement.x;
          text.y = bgElement.y;
          text.resize(bgElement.width, bgElement.height);

          alignedCount++;

          // Логируем только первые 5 для краткости
          if (alignedCount <= 5) {
            figma.ui.postMessage({
              type: 'log',
              message: `✅ Текст "${text.name}" выровнен по ${bgElement.type} "${bgElement.name}" (${Math.round(bgElement.width)}x${Math.round(bgElement.height)})`
            });
          }
        } catch (e) {
          figma.ui.postMessage({
            type: 'log',
            message: `⚠️ Ошибка "${text.name}": ${e.message}`
          });
        }
      } else {
        figma.ui.postMessage({
          type: 'log',
          message: `⚠️ Для текста "${text.name}" не найден фоновый элемент`
        });
      }
    }
  }

  // Итоговая статистика
  figma.ui.postMessage({
    type: 'log',
    message: `📊 Итого найдено: Фоновых элементов: ${totalRectangles}, Text: ${totalTexts}`
  });

  if (alignedCount > 0) {
    figma.ui.postMessage({ type: 'status', message: `✅ Выровнено текстов: ${alignedCount}` });
    figma.ui.postMessage({ type: 'log', message: `🎉 Выровнено текстов: ${alignedCount}` });
    figma.notify(`✅ Выровнено текстов: ${alignedCount}`);
  } else {
    if (totalRectangles === 0 && totalTexts === 0) {
      figma.ui.postMessage({ type: 'error', message: '❌ Не найдено подходящих элементов (фон + текст)' });
      figma.notify('Не найдено подходящих элементов');
    } else if (totalRectangles === 0) {
      figma.ui.postMessage({ type: 'error', message: `❌ Не найдено фоновых элементов (найдено только ${totalTexts} текстов). Выберите элементы вместе с их родителями (Frame/Component)` });
      figma.notify('Не найдено фоновых элементов. Выберите родительский Frame/Component');
    } else if (totalTexts === 0) {
      figma.ui.postMessage({ type: 'error', message: `❌ Не найдено Text (найдено только ${totalRectangles} фоновых элементов)` });
      figma.notify('Не найдено Text');
    } else {
      figma.ui.postMessage({ type: 'error', message: `❌ Фон и Text должны быть в одной группе/родителе. Попробуйте выбрать родительский элемент (Frame/Component)` });
      figma.notify('Выберите родительский элемент, содержащий и фон и текст');
    }
  }
}

// Выравнивание высоты текстов
async function alignTextHeights() {
  figma.ui.postMessage({ type: 'log', message: '📏 Начинаю выравнивание высоты текстов...' });

  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({ type: 'error', message: '❌ Выберите хотя бы 2 текстовых элемента' });
    figma.notify('Выберите хотя бы 2 текстовых элемента');
    return;
  }

  figma.ui.postMessage({ type: 'log', message: `📦 Выбрано элементов: ${selection.length}` });

  // Собираем все текстовые элементы
  const textNodes = [];

  function collectTextNodes(node) {
    if (node.type === 'TEXT') {
      textNodes.push(node);
    }

    if ('children' in node) {
      for (const child of node.children) {
        collectTextNodes(child);
      }
    }
  }

  for (const node of selection) {
    if (node.type === 'TEXT') {
      figma.ui.postMessage({ type: 'log', message: `🔍 Найден текст: "${node.name}"` });
    }
    collectTextNodes(node);
  }

  figma.ui.postMessage({ type: 'log', message: `📊 Найдено текстовых элементов: ${textNodes.length}` });

  if (textNodes.length === 0) {
    figma.ui.postMessage({ type: 'error', message: '❌ Не найдено ни одного текстового элемента' });
    figma.notify('Не найдено текстовых элементов');
    return;
  }

  if (textNodes.length < 2) {
    figma.ui.postMessage({ type: 'error', message: `❌ Найден только 1 текст ("${textNodes[0].name}"). Нужно минимум 2` });
    figma.notify('Найден только 1 текст. Нужно минимум 2');
    return;
  }

  // Берем высоту первого текста как эталон
  const referenceHeight = textNodes[0].height;
  const referenceY = textNodes[0].y;

  figma.ui.postMessage({
    type: 'log',
    message: `📌 Эталон: "${textNodes[0].name}" (высота: ${Math.round(referenceHeight)}px, Y: ${Math.round(referenceY)}px)`
  });

  let successCount = 0;
  let errorCount = 0;

  // Выравниваем остальные тексты
  for (let i = 1; i < textNodes.length; i++) {
    const text = textNodes[i];
    try {
      const oldHeight = text.height;
      const oldY = text.y;
      text.resize(text.width, referenceHeight);
      text.y = referenceY;

      successCount++;
      figma.ui.postMessage({
        type: 'log',
        message: `✅ "${text.name}": высота ${Math.round(oldHeight)}px → ${Math.round(referenceHeight)}px, Y ${Math.round(oldY)}px → ${Math.round(referenceY)}px`
      });
    } catch (e) {
      errorCount++;
      figma.ui.postMessage({
        type: 'log',
        message: `⚠️ Ошибка "${text.name}": ${e.message}`
      });
    }
  }

  // Итоговая статистика
  figma.ui.postMessage({
    type: 'log',
    message: `📊 Обработано: успешно ${successCount + 1}, ошибок ${errorCount}`
  });

  figma.ui.postMessage({ type: 'status', message: `✅ Выровнено текстов: ${textNodes.length}` });
  figma.ui.postMessage({ type: 'log', message: `🎉 Выровнено текстов: ${textNodes.length}` });
  figma.notify(`✅ Выровнено текстов: ${textNodes.length}`);
}

// Версия uploadAllImages для HTML - не экспортирует простые закругленные прямоугольники
async function uploadImagesForHTML(root, token) {
  const hashes = new Set();
  const exportNodes = [];
  const processedNodes = new Set();
  const hashToNodeMap = new Map();

  const collect = (n) => {
    if (processedNodes.has(n.id)) return;
    processedNodes.add(n.id);

    const hasEffects = n.effects && Array.isArray(n.effects) && n.effects.length > 0;
    // НЕ пропускаем невидимые элементы
    try {
      if (typeof n.opacity === 'number' && n.opacity <= 0 && !hasEffects) {
        if ('children' in n && Array.isArray(n.children)) {
          for (const child of n.children) {
            collect(child);
          }
        }
        return;
      }
    } catch (_) { }

    // Для HTML: НЕ экспортируем простые закругленные прямоугольники
    // Экспортируем только если есть градиенты, эффекты или сложные наложения
    const shouldExport = shouldExportAsImageForHTML(n);
    if (shouldExport) {
      exportNodes.push(n);
      figma.ui.postMessage({ type: 'log', message: `📸 Экспорт: ${n.name || n.id}` });
    }

    if ('fills' in n && Array.isArray(n.fills)) {
      for (const f of n.fills) {
        if (f.type === 'IMAGE' && f.imageHash) {
          hashes.add(f.imageHash);
          if (!hashToNodeMap.has(f.imageHash)) {
            hashToNodeMap.set(f.imageHash, n);
          }
        }
      }
    }

    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) {
        collect(child);
      }
    }
  };

  collect(root);

  const emptyMap = new Map();
  if (!hashes.size && !exportNodes.length) {
    figma.ui.postMessage({ type: 'log', message: '🖼️ Изображений для загрузки не найдено' });
    return emptyMap;
  }

  // Остальная логика такая же как в uploadAllImages
  const imagesPayload = [];
  const nameToHashMap = new Map();
  const nodeIdToFileNameMap = new Map();
  const usedFileNames = new Set();

  for (const hash of hashes) {
    try {
      const image = figma.getImageByHash(hash);
      if (!image) continue;
      const bytes = await image.getBytesAsync();
      const node = hashToNodeMap.get(hash);
      const baseFileName = sanitizeFileName(node ? (node.name || `image_${hash.substring(0, 8)}`) : `image_${hash.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNames);
      const finalFileName = `${fileName}.png`;
      imagesPayload.push({ hash, bytes: Array.from(bytes), filename: finalFileName, mime: 'image/png', originalHash: hash });
      nameToHashMap.set(finalFileName, hash);
      if (node) nodeIdToFileNameMap.set(node.id, finalFileName);
    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: `❌ Ошибка: ${err.message}` });
    }
  }

  for (const node of exportNodes) {
    try {
      // Группы больше не обрабатываются специальным образом
      const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });

      const baseFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNames);
      const finalFileName = `${fileName}.png`;
      const exportKey = `export_${node.id}`;
      imagesPayload.push({ hash: exportKey, bytes: Array.from(bytes), filename: finalFileName, mime: 'image/png', originalHash: exportKey });
      nameToHashMap.set(finalFileName, exportKey);
      nodeIdToFileNameMap.set(node.id, finalFileName);
    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: `❌ Ошибка экспорта: ${err.message}` });
    }
  }

  figma.ui.postMessage({ type: 'cache-images', images: imagesPayload });
  if (token && token.trim()) {
    figma.ui.postMessage({ type: 'upload-images', images: imagesPayload, token });
    const resultMap = await new Promise((resolve) => { pendingUploadResolve = resolve; });
    const nameBasedMap = new Map();
    const hashToFileNameMap = new Map();

    for (const [fileName, originalKey] of nameToHashMap.entries()) {
      hashToFileNameMap.set(originalKey, fileName);
    }

    if (resultMap) {
      for (const [key, value] of resultMap.entries()) {
        if (key.endsWith('.png')) {
          nameBasedMap.set(key, value);
        } else {
          const fileName = hashToFileNameMap.get(key);
          if (fileName) {
            nameBasedMap.set(fileName, value);
            nameBasedMap.set(key, value);
          } else {
            nameBasedMap.set(key, value);
          }
        }
      }
    }

    nameBasedMap.hashToFileName = hashToFileNameMap;
    nameBasedMap.nodeIdToFileName = nodeIdToFileNameMap;
    return nameBasedMap;
  } else {
    const placeholder = new Map();
    const hashToFileNameMap = new Map();
    const finalNodeIdToFileNameMap = new Map();
    const usedFileNamesForData = new Set();

    for (const hash of hashes) {
      const node = hashToNodeMap.get(hash);
      const baseFileName = sanitizeFileName(node ? (node.name || `image_${hash.substring(0, 8)}`) : `image_${hash.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNamesForData);
      const fullFileName = `${fileName}.png`;
      placeholder.set(fullFileName, 'data');
      placeholder.set(hash, 'data');
      hashToFileNameMap.set(hash, fullFileName);
      if (node) finalNodeIdToFileNameMap.set(node.id, fullFileName);
    }
    for (const node of exportNodes) {
      const baseFileName = sanitizeFileName(node.name || `export_${node.id.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNamesForData);
      const fullFileName = `${fileName}.png`;
      const exportKey = `export_${node.id}`;
      placeholder.set(fullFileName, 'data');
      placeholder.set(exportKey, 'data');
      hashToFileNameMap.set(exportKey, fullFileName);
      finalNodeIdToFileNameMap.set(node.id, fullFileName);
    }

    placeholder.hashToFileName = hashToFileNameMap;
    placeholder.nodeIdToFileName = finalNodeIdToFileNameMap;
    return placeholder;
  }
}

// Проверка для HTML - НЕ экспортируем простые закругленные прямоугольники
function shouldExportAsImageForHTML(node) {
  if (!('exportAsync' in node)) return false;

  const hasEffects = node.effects && Array.isArray(node.effects) && node.effects.length > 0;
  if (!hasEffects) {
    try { if (typeof node.opacity === 'number' && node.opacity <= 0) return false; } catch (_) { }
  }

  const nodeName = (node.name || '').toLowerCase();

  // Векторы
  if (nodeName.includes('vector') || nodeName.includes('вектор')) {
    return true;
  }

  // RECTANGLE с закругленными углами - НЕ экспортируем для HTML (используем CSS)
  // Экспортируем только если есть градиенты или эффекты
  if (node.type === 'RECTANGLE') {
    // Проверяем наличие градиентов
    if ('fills' in node && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'GRADIENT_LINEAR' ||
          fill.type === 'GRADIENT_RADIAL' ||
          fill.type === 'GRADIENT_ANGULAR' ||
          fill.type === 'GRADIENT_DIAMOND') {
          return true; // Градиенты нужно экспортировать
        }
      }
    }
    // Если есть эффекты - экспортируем
    if (hasEffects) {
      return true;
    }
    // Простой закругленный прямоугольник без градиентов и эффектов - НЕ экспортируем
    return false;
  }

  // TEXT с градиентом
  if (node.type === 'TEXT' && 'fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'GRADIENT_LINEAR' ||
        fill.type === 'GRADIENT_RADIAL' ||
        fill.type === 'GRADIENT_ANGULAR' ||
        fill.type === 'GRADIENT_DIAMOND') {
        return true;
      }
    }
  }

  // Любой элемент с градиентом
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'GRADIENT_LINEAR' ||
        fill.type === 'GRADIENT_RADIAL' ||
        fill.type === 'GRADIENT_ANGULAR' ||
        fill.type === 'GRADIENT_DIAMOND') {
        return true;
      }
    }
  }

  // Элементы с изображениями + наложения
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 1) {
    let hasImage = false;
    let hasOtherFills = false;

    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        hasImage = true;
      } else if (fill.type === 'SOLID' ||
        fill.type === 'GRADIENT_LINEAR' ||
        fill.type === 'GRADIENT_RADIAL' ||
        fill.type === 'GRADIENT_ANGULAR' ||
        fill.type === 'GRADIENT_DIAMOND') {
        hasOtherFills = true;
      }
    }

    if (hasImage && hasOtherFills) {
      return true;
    }
  }

  // Элементы с изображениями и эффектами
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        if (hasEffects) {
          return true;
        }
      }
    }
  }

  // Элементы с эффектами
  if (hasEffects) {
    return true;
  }

  return false;
}

function generateHTMLCode(node, imageMap) {
  const rootWidth = Math.round(('width' in node ? node.width : 1920) || 1920);
  const rootHeight = Math.round(('height' in node ? node.height : 1080) || 1080);
  const frameName = node.name || 'Page';

  // ЛОГИРОВАНИЕ: Размеры корневого фрейма
  figma.ui.postMessage({
    type: 'log',
    message: `\n🎯 Корневой фрейм "${frameName}": ${rootWidth}x${rootHeight}px`
  });
  figma.ui.postMessage({
    type: 'log',
    message: `📊 Начинаю генерацию элементов...\n`
  });

  // Получаем цвет фона фрейма (для HTML берем реальный цвет, не прозрачный)
  let frameBgColor = 'white';
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      const r = Math.round((fill.color.r || 0) * 255);
      const g = Math.round((fill.color.g || 0) * 255);
      const b = Math.round((fill.color.b || 0) * 255);
      const a = (fill.opacity !== undefined ? fill.opacity : 1);
      frameBgColor = `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${frameName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .wrapper {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        
        .container {
            position: relative;
            background: ${frameBgColor};
            width: ${rootWidth}px;
            height: ${rootHeight}px;
            overflow: hidden;
            transform-origin: center center;
            transform: scale(min(calc(100vw / ${rootWidth}), calc(100vh / ${rootHeight})));
        }
        
        .element {
            position: absolute;
        }
        
        .text-element {
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        .image-element {
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
`;

  html += generateHTMLElements(node, imageMap, rootWidth, rootHeight);

  html += `        </div>
    </div>
    
    <!-- DEBUG INFO -->
    <div style="position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.8); color: white; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; z-index: 9999;">
        <div><strong>🎯 Figma Frame:</strong> ${rootWidth}x${rootHeight}px</div>
        <div><strong>📐 Container:</strong> <span id="debug-container-size"></span></div>
        <div><strong>🔍 Scale:</strong> <span id="debug-scale"></span></div>
        <div><strong>📏 First Element:</strong> <span id="debug-element-size"></span></div>
        <div><strong>👁️ Visual Size:</strong> <span id="debug-visual-size"></span></div>
    </div>
    
    <script>
        function updateDebug() {
            const container = document.querySelector('.container');
            const element = document.querySelector('.element');
            
            if (container) {
                const containerStyle = getComputedStyle(container);
                document.getElementById('debug-container-size').textContent = 
                    containerStyle.width + ' x ' + containerStyle.height;
                document.getElementById('debug-scale').textContent = 
                    containerStyle.transform || 'none';
            }
            
            if (element) {
                const elementStyle = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                document.getElementById('debug-element-size').textContent = 
                    elementStyle.width + ' x ' + elementStyle.height;
                document.getElementById('debug-visual-size').textContent = 
                    Math.round(rect.width) + 'px x ' + Math.round(rect.height) + 'px';
            }
        }
        
        window.addEventListener('load', updateDebug);
        window.addEventListener('resize', updateDebug);
    </script>
</body>
</html>`;

  // ЛОГИРОВАНИЕ: Завершение генерации
  figma.ui.postMessage({
    type: 'log',
    message: `\n✅ HTML код сгенерирован успешно!`
  });

  return html;
}

function generateHTMLElements(node, imageMap, rootWidth, rootHeight) {
  let html = '';

  if ('children' in node) {
    for (const child of node.children) {
      // Получаем абсолютные координаты для позиционирования
      const rfBounds = getAbsoluteBounds(node);
      const childBounds = getAbsoluteBounds(child);

      // Вычисляем позицию относительно родительского фрейма
      const left = Math.round(childBounds.x - rfBounds.x);
      const top = Math.round(childBounds.y - rfBounds.y);

      // ВСЕГДА используем оригинальные размеры из узла Figma (без трансформаций)
      const width = Math.round(child.width || 0);
      const height = Math.round(child.height || 0);

      // ЛОГИРОВАНИЕ: Детальная информация о размерах элемента
      figma.ui.postMessage({
        type: 'log',
        message: `📏 ${child.name}: Figma(${Math.round(child.width)}x${Math.round(child.height)}) → HTML(${width}x${height}) | Bounds(${Math.round(childBounds.width)}x${Math.round(childBounds.height)}) | Pos(${left}, ${top})`
      });

      // Пропускаем невидимые элементы
      if (width <= 0 || height <= 0) {
        figma.ui.postMessage({ type: 'log', message: `⚠️ Пропущен ${child.name}: нулевой размер` });
        continue;
      }

      const hasImage = hasImageFill(child, imageMap);
      const imageUrl = hasImage ? getImageUrl(child, imageMap) : null;

      if (hasImage && imageUrl) {
        // Изображение (включая закругленные прямоугольники, которые экспортируются как PNG)
        html += `        <img class="element image-element" src="${imageUrl}" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; object-fit: contain;" />\n`;
      } else if (child.type === 'TEXT') {
        // Текст
        const textColor = getRGBAColor(child);
        const fontSize = typeof child.fontSize === 'number' ? child.fontSize : 14;
        const text = child.characters || '';
        const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        html += `        <div class="element text-element" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; font-size: ${fontSize}px; color: rgba(${Math.round(parseFloat(textColor.split(' ')[0]) * 255)}, ${Math.round(parseFloat(textColor.split(' ')[1]) * 255)}, ${Math.round(parseFloat(textColor.split(' ')[2]) * 255)}, ${textColor.split(' ')[3]});">${escapedText}</div>\n`;
      } else if (child.type === 'RECTANGLE') {
        // Прямоугольник с цветом и возможными закругленными углами
        const color = getRGBAColor(child);
        const bgColor = `rgba(${Math.round(parseFloat(color.split(' ')[0]) * 255)}, ${Math.round(parseFloat(color.split(' ')[1]) * 255)}, ${Math.round(parseFloat(color.split(' ')[2]) * 255)}, ${color.split(' ')[3]})`;

        // Проверяем закругленные углы
        let borderRadius = '';
        if (typeof child.cornerRadius === 'number' && child.cornerRadius > 0) {
          borderRadius = `border-radius: ${child.cornerRadius}px;`;
        } else if (typeof child.cornerRadius === 'symbol') {
          // Разные радиусы для каждого угла
          const tl = child.topLeftRadius || 0;
          const tr = child.topRightRadius || 0;
          const br = child.bottomRightRadius || 0;
          const bl = child.bottomLeftRadius || 0;
          if (tl > 0 || tr > 0 || br > 0 || bl > 0) {
            borderRadius = `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`;
          }
        }

        html += `        <div class="element" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; background: ${bgColor}; ${borderRadius}"></div>\n`;

        // Рекурсивно обрабатываем дочерние элементы
        if ('children' in child) {
          html += generateHTMLElements(child, imageMap, rootWidth, rootHeight);
        }
      } else {
        // Другие элементы (GROUP, FRAME и т.д.)
        const color = getRGBAColor(child);
        const bgColor = `rgba(${Math.round(parseFloat(color.split(' ')[0]) * 255)}, ${Math.round(parseFloat(color.split(' ')[1]) * 255)}, ${Math.round(parseFloat(color.split(' ')[2]) * 255)}, ${color.split(' ')[3]})`;

        // Только если есть видимый цвет
        if (parseFloat(color.split(' ')[3]) > 0) {
          html += `        <div class="element" style="left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; background: ${bgColor};"></div>\n`;
        }

        // Рекурсивно обрабатываем дочерние элементы
        if ('children' in child) {
          html += generateHTMLElements(child, imageMap, rootWidth, rootHeight);
        }
      }
    }
  }

  return html;
}


// ===== KEEP ONLY IMAGES =====
async function keepOnlyImagesInFrame() {
  figma.ui.postMessage({ type: 'log', message: '🗑️ Начинаю удаление элементов...' });

  const node = figma.currentPage.selection[0];
  if (!node || node.type !== 'FRAME') {
    figma.ui.postMessage({ type: 'error', message: 'Выберите корневой Frame в Figma' });
    return;
  }

  try {
    let deletedCount = 0;
    let keptCount = 0;

    // Функция проверки - является ли элемент изображением
    const isImageElement = (n) => {
      // Пропускаем Ellipse - они не нужны
      if (n.type === 'ELLIPSE') {
        return false;
      }

      // Проверяем fills с изображениями
      if ('fills' in n && Array.isArray(n.fills)) {
        for (const fill of n.fills) {
          if (fill.type === 'IMAGE' && fill.imageHash) {
            return true;
          }
        }
      }

      // Проверяем нужно ли экспортировать как изображение (векторы, эффекты и т.д.)
      if (shouldExportAsImage(n)) {
        return true;
      }

      return false;
    };

    // Собираем все изображения из вложенных фреймов/групп
    const imagesToKeep = [];

    const collectImages = (parent, depth = 0) => {
      if (!('children' in parent)) return;

      for (const child of parent.children) {
        try {
          if (!child || child.removed) continue;

          // Если это изображение - добавляем в список
          if (isImageElement(child)) {
            imagesToKeep.push({
              node: child,
              depth: depth
            });
          }

          // Рекурсивно обходим детей
          if (child.type === 'FRAME' || child.type === 'GROUP') {
            collectImages(child, depth + 1);
          }
        } catch (e) {
          // Пропускаем недоступные узлы
        }
      }
    };

    // Собираем все изображения
    collectImages(node);

    figma.ui.postMessage({ type: 'log', message: `📋 Найдено изображений: ${imagesToKeep.length}` });

    // Перемещаем все изображения в корневой фрейм
    for (const item of imagesToKeep) {
      try {
        if (!item.node || item.node.removed) continue;

        const img = item.node;
        const imgName = img.name || 'Unnamed';

        // Если изображение уже в корневом фрейме - пропускаем
        if (img.parent === node) {
          keptCount++;
          continue;
        }

        // Получаем абсолютные координаты
        const absX = img.absoluteTransform[0][2];
        const absY = img.absoluteTransform[1][2];
        const nodeX = node.absoluteTransform[0][2];
        const nodeY = node.absoluteTransform[1][2];

        // Вычисляем относительные координаты
        const relX = absX - nodeX;
        const relY = absY - nodeY;

        // Перемещаем в корневой фрейм
        node.appendChild(img);
        img.x = relX;
        img.y = relY;

        keptCount++;
        figma.ui.postMessage({ type: 'log', message: `✅ Перемещено: ${imgName}` });
      } catch (e) {
        figma.ui.postMessage({ type: 'log', message: `⚠️ Ошибка перемещения: ${e.message}` });
      }
    }

    // Теперь удаляем всё кроме изображений в корневом фрейме
    const children = [...node.children];

    for (const child of children) {
      try {
        if (!child || child.removed) continue;

        const childName = child.name || 'Unnamed';
        const childType = child.type;

        // Если это изображение - оставляем
        if (isImageElement(child)) {
          figma.ui.postMessage({ type: 'log', message: `✅ Оставлено: ${childName}` });
        }
        // Иначе удаляем (включая фреймы и группы)
        else {
          child.remove();
          deletedCount++;
          figma.ui.postMessage({ type: 'log', message: `🗑️ Удалён: ${childName} (${childType})` });
        }
      } catch (e) {
        figma.ui.postMessage({ type: 'log', message: `⚠️ Ошибка удаления: ${e.message}` });
      }
    }

    figma.ui.postMessage({ type: 'log', message: `✅ Удалено элементов: ${deletedCount}` });
    figma.ui.postMessage({ type: 'log', message: `✅ Оставлено изображений: ${keptCount}` });
    figma.ui.postMessage({ type: 'keep-only-images-complete', deleted: deletedCount, kept: keptCount });
    figma.ui.postMessage({ type: 'log', message: '🎉 Готово!' });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
}

// ===== DOWNLOAD ALL IMAGES =====
async function downloadAllImagesFromFrame() {
  figma.ui.postMessage({ type: 'log', message: '📸 Начинаю экспорт изображений...' });

  const node = figma.currentPage.selection[0];
  if (!node || node.type !== 'FRAME') {
    figma.ui.postMessage({ type: 'error', message: 'Выберите корневой Frame в Figma' });
    return;
  }

  const frameName = node.name || 'Frame';

  try {
    const allImages = [];
    const processedNodes = new Set();

    // Собираем все изображения (fills + экспортируемые элементы)
    const collectImages = (n) => {
      if (processedNodes.has(n.id)) return;
      processedNodes.add(n.id);

      // Проверяем fills с изображениями
      if ('fills' in n && Array.isArray(n.fills)) {
        for (const fill of n.fills) {
          if (fill.type === 'IMAGE' && fill.imageHash) {
            allImages.push({ node: n, type: 'fill', hash: fill.imageHash });
          }
        }
      }

      // Проверяем нужно ли экспортировать как изображение
      if (shouldExportAsImage(n)) {
        allImages.push({ node: n, type: 'export', hash: null });
      }

      if ('children' in n && Array.isArray(n.children)) {
        for (const child of n.children) {
          collectImages(child);
        }
      }
    };

    collectImages(node);

    figma.ui.postMessage({ type: 'log', message: `📋 Найдено изображений: ${allImages.length}` });

    if (!allImages.length) {
      figma.ui.postMessage({ type: 'error', message: 'Изображений не найдено' });
      return;
    }

    // Отправляем начало
    figma.ui.postMessage({
      type: 'images-start',
      total: allImages.length,
      frameName: frameName
    });

    // Экспортируем и отправляем изображения по одному
    const usedFileNames = new Set();
    let successCount = 0;

    for (let i = 0; i < allImages.length; i++) {
      const item = allImages[i];
      const progress = `${i + 1}/${allImages.length}`;

      try {
        let bytes;
        let fileName;

        if (item.type === 'fill' && item.hash) {
          // Экспортируем изображение из fill
          const image = figma.getImageByHash(item.hash);
          if (image) {
            bytes = await image.getBytesAsync();
            const baseName = sanitizeFileName(item.node.name || `image_${item.hash.substring(0, 8)}`);
            fileName = getUniqueFileName(baseName, usedFileNames);
          }
        } else if (item.type === 'export') {
          // Экспортируем элемент целиком
          // Группы больше не обрабатываются специальным образом
          bytes = await item.node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });

          const baseName = sanitizeFileName(item.node.name || `element_${item.node.id.substring(0, 8)}`);
          fileName = getUniqueFileName(baseName, usedFileNames);
        }

        if (bytes && fileName) {
          // Отправляем сразу после экспорта
          figma.ui.postMessage({
            type: 'images-chunk',
            images: [{
              name: `${fileName}.png`,
              data: Array.from(bytes)
            }]
          });

          successCount++;
          figma.ui.postMessage({ type: 'log', message: `✅ [${progress}] Экспортирован: ${fileName}.png` });

          // Очищаем bytes из памяти
          bytes = null;
        }
      } catch (e) {
        figma.ui.postMessage({ type: 'log', message: `⚠️ [${progress}] Ошибка: ${item.node.name}` });
      }

      // Небольшая задержка для освобождения памяти
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!successCount) {
      figma.ui.postMessage({ type: 'error', message: 'Не удалось экспортировать изображения' });
      return;
    }

    figma.ui.postMessage({ type: 'images-complete' });
    figma.ui.postMessage({ type: 'log', message: `🎉 Готово! Экспортировано ${successCount} изображений` });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
}

// ===== CSS GENERATION WITH CLASS NAMES =====
async function generateCSSCode() {
  figma.ui.postMessage({ type: 'log', message: '🎨 Начинаю генерацию CSS...' });

  const node = figma.currentPage.selection[0];
  if (!node || node.type !== 'FRAME') {
    figma.ui.postMessage({ type: 'error', message: 'Выберите корневой Frame в Figma' });
    return;
  }

  const frameName = node.name || 'Frame';

  try {
    const elements = [];
    collectAllElements(node, elements);

    figma.ui.postMessage({ type: 'log', message: `📦 Фрейм: ${frameName}` });
    figma.ui.postMessage({ type: 'log', message: `📋 Найдено элементов: ${elements.length}` });

    // Загружаем изображения для сложных элементов
    figma.ui.postMessage({ type: 'log', message: '📸 Загружаю изображения...' });
    const imageMap = await uploadImagesForCSS(node, currentApiToken);

    const cssCode = generateCSSFromFrame(node, imageMap);
    const htmlCode = generateHTMLFromFrame(node, cssCode);

    figma.ui.postMessage({
      type: 'css-generated',
      css: cssCode,
      html: htmlCode,
      frameName: frameName
    });
    figma.ui.postMessage({ type: 'log', message: '🎉 CSS генерация завершена!' });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
}

// Загрузка изображений для CSS (экспортируем сложные элементы)
async function uploadImagesForCSS(root, token) {
  const exportNodes = [];
  const processedNodes = new Set();

  const collect = (n) => {
    if (processedNodes.has(n.id)) return;
    processedNodes.add(n.id);

    // Проверяем нужно ли экспортировать как изображение
    if (shouldExportAsImage(n)) {
      exportNodes.push(n);
      figma.ui.postMessage({ type: 'log', message: `📸 Экспорт: ${n.name || n.id}` });
    }

    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) {
        collect(child);
      }
    }
  };

  collect(root);

  const emptyMap = new Map();
  if (!exportNodes.length) {
    figma.ui.postMessage({ type: 'log', message: '🖼️ Изображений для экспорта не найдено' });
    return emptyMap;
  }

  const imagesPayload = [];
  const nodeIdToFileNameMap = new Map();
  const usedFileNames = new Set();

  for (const node of exportNodes) {
    try {
      // Группы больше не обрабатываются специальным образом
      const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });

      const baseFileName = sanitizeFileName(node.name || `element_${node.id.substring(0, 8)}`);
      const fileName = getUniqueFileName(baseFileName, usedFileNames);
      const finalFileName = `${fileName}.png`;

      imagesPayload.push({
        nodeId: node.id,
        bytes: Array.from(bytes),
        filename: finalFileName,
        mime: 'image/png'
      });

      nodeIdToFileNameMap.set(node.id, finalFileName);
      figma.ui.postMessage({ type: 'log', message: `✅ Экспортирован: ${finalFileName}` });
    } catch (e) {
      figma.ui.postMessage({ type: 'log', message: `⚠️ Не удалось экспортировать: ${node.name}` });
    }
  }

  if (!imagesPayload.length) {
    return emptyMap;
  }

  // Загружаем на сервер по частям (по 5 изображений)
  const resultMap = new Map();
  const chunkSize = 5;
  const totalChunks = Math.ceil(imagesPayload.length / chunkSize);

  figma.ui.postMessage({ type: 'log', message: `📤 Загружаю ${imagesPayload.length} изображений (по ${chunkSize} за раз)...` });

  for (let i = 0; i < imagesPayload.length; i += chunkSize) {
    const chunk = imagesPayload.slice(i, i + chunkSize);
    const chunkNum = Math.floor(i / chunkSize) + 1;

    figma.ui.postMessage({ type: 'log', message: `📤 Загружаю пакет ${chunkNum}/${totalChunks} (${chunk.length} изображений)...` });

    try {
      const response = await fetch(`${API_BASE}/api/upload-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ images: chunk })
      });

      if (!response.ok) {
        figma.ui.postMessage({ type: 'log', message: `⚠️ Ошибка загрузки пакета ${chunkNum}: ${response.status}` });
        continue;
      }

      const result = await response.json();

      if (result.urls && Array.isArray(result.urls)) {
        for (const item of result.urls) {
          if (item.nodeId && item.url) {
            resultMap.set(item.nodeId, item.url);
          }
        }
        figma.ui.postMessage({ type: 'log', message: `✅ Пакет ${chunkNum}/${totalChunks} загружен (${result.urls.length} изображений)` });
      }
    } catch (e) {
      figma.ui.postMessage({ type: 'log', message: `⚠️ Ошибка загрузки пакета ${chunkNum}: ${e.message}` });
    }

    // Небольшая задержка между запросами
    if (i + chunkSize < imagesPayload.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  figma.ui.postMessage({ type: 'log', message: `✅ Загружено ${resultMap.size} из ${imagesPayload.length} изображений` });
  return resultMap;
}

function generateCSSFromFrame(node, imageMap = new Map()) {
  let css = '';
  let classCounter = 0;
  const classNames = new Map();

  function getClassName(node) {
    if (classNames.has(node.id)) {
      return classNames.get(node.id);
    }

    const baseName = sanitizeClassName(node.name || 'element');
    const className = `${baseName}-${classCounter++}`;
    classNames.set(node.id, className);
    return className;
  }

  function processNode(node, parentBounds = null, rootBounds = null) {
    if (!node.visible) return;

    const className = getClassName(node);
    const bounds = getAbsoluteBounds(node);

    // Проверяем, нужно ли использовать изображение
    const useImage = shouldExportAsImage(node) && imageMap.has(node.id);

    css += `.${className} {\n`;

    // Position - нормализуем относительно корневого фрейма
    if (parentBounds) {
      css += `  position: absolute;\n`;
      const left = Math.round(bounds.x - rootBounds.x);
      const top = Math.round(bounds.y - rootBounds.y);
      css += `  left: ${left}px;\n`;
      css += `  top: ${top}px;\n`;
    }

    // Size
    if ('width' in node && 'height' in node) {
      css += `  width: ${Math.round(node.width)}px;\n`;
      css += `  height: ${Math.round(node.height)}px;\n`;
    }

    // Если используем изображение - добавляем background-image
    if (useImage) {
      const imageUrl = imageMap.get(node.id);
      css += `  background-image: url('${imageUrl}');\n`;
      css += `  background-size: cover;\n`;
      css += `  background-position: center;\n`;
      css += `  background-repeat: no-repeat;\n`;
    }
    // Иначе используем обычные fills
    else if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.visible !== false) {
        if (fill.type === 'SOLID') {
          const color = rgbToHex(fill.color);
          const opacity = fill.opacity !== undefined ? fill.opacity : 1;
          css += `  background-color: ${color};\n`;
          if (opacity < 1) {
            css += `  opacity: ${opacity.toFixed(2)};\n`;
          }
        } else if (fill.type === 'GRADIENT_LINEAR') {
          css += `  background: linear-gradient(${getGradientCSS(fill)});\n`;
        }
      }
    }

    // Border radius
    if ('cornerRadius' in node && node.cornerRadius > 0) {
      css += `  border-radius: ${Math.round(node.cornerRadius)}px;\n`;
    } else if ('topLeftRadius' in node) {
      const tl = node.topLeftRadius || 0;
      const tr = node.topRightRadius || 0;
      const br = node.bottomRightRadius || 0;
      const bl = node.bottomLeftRadius || 0;
      if (tl || tr || br || bl) {
        css += `  border-radius: ${Math.round(tl)}px ${Math.round(tr)}px ${Math.round(br)}px ${Math.round(bl)}px;\n`;
      }
    }

    // Strokes (borders)
    if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
      const stroke = node.strokes[0];
      if (stroke.visible !== false && stroke.type === 'SOLID') {
        const color = rgbToHex(stroke.color);
        const weight = node.strokeWeight || 1;
        css += `  border: ${Math.round(weight)}px solid ${color};\n`;
      }
    }

    // Text properties
    if (node.type === 'TEXT') {
      const fontSize = node.fontSize || 14;
      css += `  font-size: ${Math.round(fontSize)}px;\n`;

      if (node.fontName && node.fontName.family) {
        css += `  font-family: '${node.fontName.family}';\n`;
      }

      if (node.fontWeight) {
        css += `  font-weight: ${node.fontWeight};\n`;
      }

      const textAlign = getTextAlignCSS(node);
      if (textAlign) {
        css += `  text-align: ${textAlign};\n`;
      }

      if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID') {
          const color = rgbToHex(fill.color);
          css += `  color: ${color};\n`;
        }
      }

      if (node.letterSpacing && node.letterSpacing.value !== 0) {
        css += `  letter-spacing: ${node.letterSpacing.value}${node.letterSpacing.unit === 'PERCENT' ? '%' : 'px'};\n`;
      }

      if (node.lineHeight && node.lineHeight.value) {
        if (node.lineHeight.unit === 'PIXELS') {
          css += `  line-height: ${Math.round(node.lineHeight.value)}px;\n`;
        } else if (node.lineHeight.unit === 'PERCENT') {
          css += `  line-height: ${(node.lineHeight.value / 100).toFixed(2)};\n`;
        }
      }
    }

    // Opacity
    if ('opacity' in node && node.opacity < 1) {
      css += `  opacity: ${node.opacity.toFixed(2)};\n`;
    }

    // Effects (shadows, blur)
    if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0) {
      const shadows = [];
      for (const effect of node.effects) {
        if (!effect.visible) continue;

        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          const x = Math.round((effect.offset && effect.offset.x) || 0);
          const y = Math.round((effect.offset && effect.offset.y) || 0);
          const blur = Math.round(effect.radius || 0);
          const spread = Math.round(effect.spread || 0);
          const color = effect.color ? rgbaToString(effect.color) : 'rgba(0,0,0,0.25)';
          const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : '';
          shadows.push(`${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`);
        }
      }
      if (shadows.length > 0) {
        css += `  box-shadow: ${shadows.join(', ')};\n`;
      }
    }

    css += `}\n\n`;

    // Process children
    if ('children' in node) {
      for (const child of node.children) {
        processNode(child, bounds, rootBounds);
      }
    }
  }

  // Process root frame
  const rootClassName = getClassName(node);
  const rootBounds = getAbsoluteBounds(node);

  css += `.${rootClassName} {\n`;
  css += `  position: relative;\n`;
  css += `  width: ${Math.round(node.width)}px;\n`;
  css += `  height: ${Math.round(node.height)}px;\n`;

  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.visible !== false && fill.type === 'SOLID') {
      const color = rgbToHex(fill.color);
      css += `  background-color: ${color};\n`;
    }
  }

  css += `}\n\n`;

  // Process children
  if ('children' in node) {
    for (const child of node.children) {
      processNode(child, rootBounds, rootBounds);
    }
  }

  return css;
}

function generateHTMLFromFrame(node, cssCode) {
  const classNames = new Map();
  let classCounter = 0;

  function getClassName(node) {
    if (classNames.has(node.id)) {
      return classNames.get(node.id);
    }

    const baseName = sanitizeClassName(node.name || 'element');
    const className = `${baseName}-${classCounter++}`;
    classNames.set(node.id, className);
    return className;
  }

  function processNode(node, indent = '') {
    if (!node.visible) return '';

    const className = getClassName(node);
    let result = '';

    if (node.type === 'TEXT') {
      const text = node.characters || '';
      result += `${indent}<div class="${className}">${escapeHtml(text)}</div>\n`;
    } else {
      result += `${indent}<div class="${className}">\n`;

      if ('children' in node) {
        for (const child of node.children) {
          result += processNode(child, indent + '  ');
        }
      }

      result += `${indent}</div>\n`;
    }

    return result;
  }

  const rootClassName = getClassName(node);
  const frameName = node.name || 'Frame';
  const rootWidth = Math.round(node.width || 1920);
  const rootHeight = Math.round(node.height || 1080);

  let html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(frameName)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      overflow: hidden;
    }
    
    .viewport-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    .frame-wrapper {
      width: ${rootWidth}px;
      height: ${rootHeight}px;
      transform-origin: center center;
      transform: scale(min(calc(100vw / ${rootWidth}), calc(100vh / ${rootHeight})));
    }
    
${cssCode}
  </style>
</head>
<body>
  <div class="viewport-container">
    <div class="frame-wrapper">
`;

  html += `    <div class="${rootClassName}">\n`;

  if ('children' in node) {
    for (const child of node.children) {
      html += processNode(child, '      ');
    }
  }

  html += `    </div>
    </div>
  </div>
</body>
</html>
`;

  return html;
}

function rgbToHex(color) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function rgbaToString(color) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? color.a : 1;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

function getGradientCSS(fill) {
  // Simplified gradient - you can enhance this
  const stops = fill.gradientStops || [];
  const colors = stops.map(stop => {
    const color = rgbToHex(stop.color);
    const position = Math.round(stop.position * 100);
    return `${color} ${position}%`;
  }).join(', ');

  return `90deg, ${colors}`;
}

function getTextAlignCSS(node) {
  if (!node.textAlignHorizontal) return null;

  switch (node.textAlignHorizontal) {
    case 'LEFT': return 'left';
    case 'CENTER': return 'center';
    case 'RIGHT': return 'right';
    case 'JUSTIFIED': return 'justify';
    default: return null;
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
