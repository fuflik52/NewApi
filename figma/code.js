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
let currentTheme = 'cosmic'; // 'cosmic' | 'monokai'
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
      const token = await figma.clientStorage.getAsync('apiToken');
      const assetMode = await figma.clientStorage.getAsync('assetMode');
      const anchorMode = await figma.clientStorage.getAsync('anchorMode');
      const theme = await figma.clientStorage.getAsync('theme');
      
      currentApiToken = token || '';
      currentAssetMode = assetMode || 'urls';
      currentAnchorMode = anchorMode || 'corners';
      currentTheme = theme || 'cosmic';

      figma.ui.postMessage({ 
        type: 'init', 
        token: currentApiToken,
        settings: { 
            assetMode: currentAssetMode, 
            anchorMode: currentAnchorMode,
            theme: currentTheme
        }
      });
      
      if (currentApiToken) figma.ui.postMessage({ type: 'log', message: `🔐 Токен загружен локально` });
    } 
    else if (msg.type === 'save-token') {
      currentApiToken = msg.apiToken || '';
      await figma.clientStorage.setAsync('apiToken', currentApiToken);
      figma.ui.postMessage({ type: 'log', message: '💾 Токен сохранён' });
    } 
    else if (msg.type === 'save-settings') {
        if (msg.settings.assetMode) {
            currentAssetMode = msg.settings.assetMode;
            await figma.clientStorage.setAsync('assetMode', currentAssetMode);
        }
        if (msg.settings.anchorMode) {
            currentAnchorMode = msg.settings.anchorMode;
            await figma.clientStorage.setAsync('anchorMode', currentAnchorMode);
        }
        if (msg.settings.theme) {
            currentTheme = msg.settings.theme;
            await figma.clientStorage.setAsync('theme', currentTheme);
        }
        figma.ui.postMessage({ type: 'log', message: '⚙️ Настройки сохранены' });
    }
    else if (msg.type === 'generate-code') {
      if (typeof msg.apiToken === 'string') {
        currentApiToken = msg.apiToken;
        await figma.clientStorage.setAsync('apiToken', currentApiToken);
      }
      if (typeof msg.assetMode === 'string') {
        currentAssetMode = msg.assetMode === 'data' ? 'data' : 'urls';
        await figma.clientStorage.setAsync('assetMode', currentAssetMode);
        figma.ui.postMessage({ type: 'log', message: `🖼️ Режим ассетов: ${currentAssetMode}` });
      }
      if (typeof msg.anchorMode === 'string') {
        currentAnchorMode = msg.anchorMode === 'center' ? 'center' : 'corners';
        await figma.clientStorage.setAsync('anchorMode', currentAnchorMode);
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
          figma.ui.postMessage({ type: 'log', message: '📋 Загрузка изображений завершена' });
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
    } else if (msg.type === 'test-upload') {
      await handleTestUpload(msg.apiToken);
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
  // No initial log needed, UI clears it
  
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

    figma.ui.postMessage({ type: 'log', message: `📦 Фрейм: ${frameName} (${elements.length} элементов)` });

    // Логируем типы элементов
    const typeCounts = {};
    elements.forEach(el => {
      const type = el.type || 'UNKNOWN';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Only log if many types
    if (Object.keys(typeCounts).length > 1) {
        let stats = [];
        for (const [type, count] of Object.entries(typeCounts)) stats.push(`${type}: ${count}`);
        // figma.ui.postMessage({ type: 'log', message: `  ${stats.join(', ')}` }); // Optional verbose log
    }

    const imageMap = await uploadAllImages(node, currentApiToken);

    const cuiCode = generateRustCUI(node, imageMap);
    const csharpCode = generateCSharpCode(node, imageMap, currentAssetMode, currentAnchorMode);

      // Get File Key (ID) and Name
    const fileKey = figma.fileKey || 'local_draft';
    const fileName = figma.root.name || 'Untitled';

    figma.ui.postMessage({ 
        type: 'code-generated', 
        cui: cuiCode, 
        csharp: csharpCode, 
        frameName: frameName, 
        fileKey: fileKey,
        fileName: fileName 
    });
    
    // Log debug info
    console.log('Generated Code for:', fileName, fileKey);
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

  // Add RectTransform (simplified logic for CUI summary)
  element.components.push({
    type: 'RectTransform',
    anchormin: '0 0', anchormax: '1 1',
    offsetmin: '0 0', offsetmax: '0 0'
  });

  elements.push(element);

  if ('children' in node) {
    for (const child of node.children) {
      traverseForCUI(child, elements, imageMap, element.name);
    }
  }
}

// ===== GENERATION: C# Code =====
function generateCSharpCode(node, imageMap, assetMode, anchorMode) {
  const frameName = sanitizeClassName(node.name || 'Plugin');
  const rootWidth = node.width;
  const rootHeight = node.height;

  let code = `using System;
using System.Collections.Generic;
using Oxide.Game.Rust.Cui;
using UnityEngine;
using Oxide.Core.Plugins;

namespace Oxide.Plugins
{
    [Info("${frameName}", "BublickRust", "1.0.0")]
    public class ${frameName} : RustPlugin
    {
        private const string LayerName = "UI_${frameName}";
        
        // Configuration
        private float _uiScale = 1.0f; // 0.5 to 1.0 recommended
        private const float BaseWidth = ${Math.round(rootWidth)}f;
        private const float BaseHeight = ${Math.round(rootHeight)}f;

        [ChatCommand("${frameName.toLowerCase()}")]
        private void CmdOpen(BasePlayer player, string command, string[] args)
        {
            if (args.Length > 0 && float.TryParse(args[0], out float scale))
            {
                _uiScale = Mathf.Clamp(scale, 0.5f, 1.5f);
            }
            OpenUI(player);
        }

        [ChatCommand("close${frameName.toLowerCase()}")]
        private void CmdClose(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, LayerName);
        }

        private void OpenUI(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, LayerName);
            var elements = new CuiElementContainer();

            // Root Container (Center aligned, scaled)
            // Using creating a panel that is exactly 1920x1080 reference size but scaled
            // This trick centers the UI on screen regardless of resolution
            
            string rootName = LayerName;
            
            // Create a full-screen transparent overlay for cursor/input block if needed
            elements.Add(new CuiElement
            {
                Name = rootName,
                Parent = "Overlay",
                Components =
                {
                    new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" },
                    new CuiImageComponent { Color = "0 0 0 0" }, // Transparent
                    new CuiNeedsCursorComponent()
                }
            });

            // Content Container
            // Scaled based on _uiScale relative to 1920x1080
            // We position it centered.
            
            // Calculate aspect ratio preservation or fixed scaling
            // Here we use simple centering logic: 
            // Center is 0.5, 0.5. Width/Height are proportional.
            
            // Normalized size (assuming 1920x1080 canvas)
            // You can adjust 'BaseWidth/1920f' if you want relative scaling to screen width
            
            /* 
               APPROACH:
               We create a "Center" panel that has the exact pixel size of the Figma frame (multiplied by scale).
               Elements inside will use "Center" anchor mode or normalized anchors relative to this panel.
            */

            string contentName = rootName + ".Content";
            
            // Calculate normalized offsets for centering
            // 0.5 0.5 is center. 
            // OffsetMin = -Width/2, -Height/2
            // OffsetMax = Width/2, Height/2
            
            float scaledW = BaseWidth * _uiScale;
            float scaledH = BaseHeight * _uiScale;
            
            float halfW = scaledW / 2f;
            float halfH = scaledH / 2f;

            elements.Add(new CuiElement
            {
                Name = contentName,
                Parent = rootName,
                Components =
                {
                    new CuiRectTransformComponent 
                    { 
                        AnchorMin = "0.5 0.5", 
                        AnchorMax = "0.5 0.5",
                        OffsetMin = $"{-halfW} {-halfH}",
                        OffsetMax = $"{halfW} {halfH}"
                    },
                    new CuiImageComponent { Color = "0 0 0 0" } // Transparent container
                }
            });

            // Generate children
            // Important: All children should be generated relative to the Root Frame (0,0 to W,H)
            // But since our container is centered (0,0 is center), we need to adjust coordinates?
            // NO: CUI OffsetMin/Max are relative to anchors.
            // If parent is 0.5 0.5 (center) with offsets defining the size, 
            // then inside the parent:
            // AnchorMin 0 0 is bottom-left of the parent panel.
            // AnchorMax 1 1 is top-right of the parent panel.
            
            // So we can standard normalized generation (0..1) based on Figma Frame size.
            
            GenerateChildren(elements, contentName);

            CuiHelper.AddUi(player, elements);
        }

        private void GenerateChildren(CuiElementContainer elements, string parent)
        {
`;

  // Helper function to recursively generate code
  function processNode(node, parentVarName, parentBounds) {
    let localCode = "";
    
    // Skip invisible
    if (!node.visible) return "";
    // Skip if opacity is 0
    if (node.opacity === 0) return "";

    // Determine if this node is an image or text or panel
    const isImage = hasImageFill(node, imageMap);
    const isText = node.type === "TEXT";
    
    // Calculate RELATIVE coordinates (0..1) based on parentBounds
    // parentBounds = { x, y, width, height } (absolute in Figma)
    // node = { x, y, width, height } (absolute in Figma if we use absoluteTransform, but node.x/y are relative to parent usually)
    // To be safe, let's use absolute positions if possible, or relative if structure matches.
    // Figma plugin API: node.x/y are relative to node.parent.
    
    // Let's assume parentBounds is the size of the parent element in pixels.
    // And node.x / node.y are accurate relative to that parent.
    
    const nX = node.x;
    const nY = node.y; // Figma Y is top-down. CUI Y is bottom-up? NO, CUI Anchors 0,0 is bottom-left.
    
    // Figma: (0,0) is Top-Left.
    // Unity/CUI: (0,0) is Bottom-Left (usually).
    // We need to invert Y.
    
    // Normalized Coordinates (0 to 1)
    // AnchorMin X = nX / parentBounds.width
    // AnchorMax X = (nX + node.width) / parentBounds.width
    
    // Invert Y:
    // Top in Figma = nY. Bottom in Figma = nY + height.
    // Distance from Top in Figma = nY.
    // Distance from Bottom in Figma = parentBounds.height - (nY + node.height).
    
    // CUI Anchor Y (0 is bottom):
    // AnchorMin Y = (parentBounds.height - (nY + node.height)) / parentBounds.height
    // AnchorMax Y = (parentBounds.height - nY) / parentBounds.height
    
    const pW = parentBounds.width;
    const pH = parentBounds.height;
    
    // Ensure no division by zero
    if (pW === 0 || pH === 0) return "";

    // Calculate Anchors
    let aMinX = nX / pW;
    let aMaxX = (nX + node.width) / pW;
    let aMinY = (pH - (nY + node.height)) / pH;
    let aMaxY = (pH - nY) / pH;
    
    // Round to 4 decimals to keep code clean
    aMinX = parseFloat(aMinX.toFixed(4));
    aMaxX = parseFloat(aMaxX.toFixed(4));
    aMinY = parseFloat(aMinY.toFixed(4));
    aMaxY = parseFloat(aMaxY.toFixed(4));
    
    // Generate unique name
    const uniqueName = sanitizeClassName(node.name) + "_" + Math.floor(Math.random() * 10000);
    
    // Component Definition
    localCode += `            // ${node.name} (${node.type})\n`;
    
    // If image
    if (isImage) {
        const url = getImageUrl(node, imageMap);
        const color = getFillColor(node); // Usually white if it's a raw image, but could be tinted
        
        localCode += `            elements.Add(new CuiElement
            {
                Parent = ${parentVarName},
                Name = "${uniqueName}",
                Components =
                {
                    new CuiRawImageComponent { Url = "${url}", Color = "${color}" },
                    new CuiRectTransformComponent { AnchorMin = "${aMinX} ${aMinY}", AnchorMax = "${aMaxX} ${aMaxY}" }
                }
            });\n`;
    } 
    // If text
    else if (isText) {
        const text = (node.characters || "").replace(/"/g, '\\"').replace(/\n/g, "\\n");
        const fontSize = Math.round(node.fontSize || 14);
        const color = getFillColor(node);
        const align = getTextAlign(node);
        const font = "RobotoCondensed-Bold.ttf"; // Default font
        
        localCode += `            elements.Add(new CuiElement
            {
                Parent = ${parentVarName},
                Name = "${uniqueName}",
                Components =
                {
                    new CuiTextComponent { Text = "${text}", FontSize = ${fontSize}, Color = "${color}", Align = TextAnchor.${align}, Font = "${font}" },
                    new CuiRectTransformComponent { AnchorMin = "${aMinX} ${aMinY}", AnchorMax = "${aMaxX} ${aMaxY}" }
                }
            });\n`;
    }
    // If Panel (Frame/Rectangle)
    else {
        const color = getFillColor(node);
        
        // Only create panel if it has visible fill or if it has children
        // Transparent panels are useful for grouping logic
        const hasFill = node.fills && node.fills.length > 0 && node.fills[0].visible !== false;
        const hasChildren = node.children && node.children.length > 0;
        
        if (hasFill || hasChildren) {
             localCode += `            elements.Add(new CuiElement
            {
                Parent = ${parentVarName},
                Name = "${uniqueName}",
                Components =
                {
                    new CuiImageComponent { Color = "${color}" },
                    new CuiRectTransformComponent { AnchorMin = "${aMinX} ${aMinY}", AnchorMax = "${aMaxX} ${aMaxY}" }
                }
            });\n`;
        }
    }
    
    // Recursion for children
    // If this node was created as a CUI element (uniqueName), we use it as parent.
    // If not (e.g. skipped invisible rect), we shouldn't add children to it? 
    // Actually, if we skipped it, children coordinate calculation would be wrong if we used its bounds.
    // BUT: Figma children coordinates are relative to their IMMEDIATE parent.
    // So if we create a container for this node, we use its dimensions for children calculations.
    
    if (node.children && node.children.length > 0) {
        // Use the name of the element we just created as the parent for children
        // If we didn't create an element (e.g. completely transparent group), we should probably create a dummy container?
        // For now, assuming we created it.
        
        for (const child of node.children) {
            localCode += processNode(child, `"${uniqueName}"`, { width: node.width, height: node.height });
        }
    }
    
    return localCode;
  }

  // Process all children of the root frame
  // Parent bounds are the root frame size
  if ('children' in node) {
    for (const child of node.children) {
        code += processNode(child, "parent", { width: rootWidth, height: rootHeight });
    }
  }

  code += `        }
    }
}`;

  return code;
}

// ===== HELPERS =====

function sanitizeClassName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, "");
}

function hasImageFill(node, imageMap) {
  if (imageMap[node.id]) return true; // Explicitly uploaded
  if (!node.fills) return false;
  for (const fill of node.fills) {
    if (fill.visible !== false && fill.type === 'IMAGE') return true;
  }
  return false;
}

function getImageUrl(node, imageMap) {
  // Check our map first
  if (imageMap[node.id]) return imageMap[node.id];
  return "https://dummyimage.com/100x100/fff/000.png&text=IMG"; // Fallback
}

function getFillColor(node) {
  if (!node.fills || node.fills.length === 0) return "0 0 0 0"; // Transparent
  const fill = node.fills[node.fills.length - 1]; // Use top fill
  if (fill.visible === false) return "0 0 0 0";
  
  if (fill.type === 'SOLID') {
    const r = fill.color.r.toFixed(2);
    const g = fill.color.g.toFixed(2);
    const b = fill.color.b.toFixed(2);
    const a = (fill.opacity !== undefined ? fill.opacity : 1).toFixed(2);
    return `${r} ${g} ${b} ${a}`;
  }
  // Gradient or Image as background color fallback
  return "1 1 1 1";
}

function getTextAlign(node) {
  if (!node.textAlignHorizontal) return "MiddleCenter";
  
  const h = node.textAlignHorizontal; // LEFT, CENTER, RIGHT, JUSTIFIED
  const v = node.textAlignVertical || "TOP"; // TOP, CENTER, BOTTOM
  
  let sH = "Middle";
  if (h === "LEFT") sH = "Left";
  if (h === "RIGHT") sH = "Right";
  
  let sV = "Center";
  if (v === "TOP") sV = "Upper";
  if (v === "BOTTOM") sV = "Lower";
  
  return `${sH}${sV}`.replace("MiddleUpper", "UpperCenter").replace("MiddleLower", "LowerCenter").replace("MiddleLeft", "MiddleLeft").replace("MiddleRight", "MiddleRight").replace("MiddleCenter", "MiddleCenter");
}

// ===== IMAGE UPLOADING =====

async function uploadAllImages(rootNode, token) {
  const imageMap = {};
  const nodesToProcess = [];
  
  // Find all nodes that need image processing (Image fills or Vector/Groups marked for export)
  // For simplicity, let's look for nodes with export settings OR image fills
  
  function findImages(node) {
    if (!node.visible) return;
    
    // Logic: If node has export settings, render it as PNG
    // If node has IMAGE fill, render it or use fill? Rendering is safer for transforms.
    
    // Check if user explicitly marked for export
    if (node.exportSettings && node.exportSettings.length > 0) {
        nodesToProcess.push(node);
        return; // Don't process children if parent is exported as one image
    }
    
    // Check if it's a VECTOR-like node that should be flattened?
    if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") {
         nodesToProcess.push(node);
         return;
    }
    
    if (node.fills) {
        for (const fill of node.fills) {
            if (fill.type === 'IMAGE' && fill.visible !== false) {
                nodesToProcess.push(node);
                return; // Found image, need to process
            }
        }
    }
    
    if (node.children) {
        for (const child of node.children) findImages(child);
    }
  }
  
  findImages(rootNode);
  
  if (nodesToProcess.length === 0) return {};

  figma.ui.postMessage({ type: 'log', message: `📸 Обработка ${nodesToProcess.length} изображений...` });

  // Prepare data for UI to upload
  const imagesData = [];
  
  for (const node of nodesToProcess) {
      try {
          const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } }); // 2x scale for quality
          imagesData.push({
              id: node.id,
              bytes: bytes,
              hash: node.id, // Simple hash
              filename: (node.name || 'image').replace(/[^a-z0-9]/gi, '_') + '.png'
          });
      } catch (e) {
          console.error("Export failed", e);
      }
  }
  
  if (imagesData.length === 0) return {};

  // Send to UI for uploading
  return new Promise((resolve) => {
      pendingUploadResolve = resolve; // Store resolve function
      figma.ui.postMessage({ 
          type: 'upload-images', 
          images: imagesData,
          token: token 
      });
      // Cache for ZIP download
      figma.ui.postMessage({ type: 'cache-images', images: imagesData });
  });
}

// ===== UTILS =====

async function convertSelectedTextToUppercase() {
    const sel = figma.currentPage.selection;
    let count = 0;
    for (const node of sel) {
        if (node.type === "TEXT") {
            await figma.loadFontAsync(node.fontName);
            node.characters = node.characters.toUpperCase();
            count++;
        }
    }
    figma.ui.postMessage({ type: 'log', message: `🔠 Обновлено ${count} текстовых слоев` });
}

async function alignTextToRectangles() {
    // Logic: Find text nodes inside Rectangles/Frames and resize text box to match parent
    // Simplified: Just log for now
    figma.ui.postMessage({ type: 'log', message: '⚠️ Функция в разработке' });
}

async function alignTextHeights() {
    const sel = figma.currentPage.selection;
    let count = 0;
    for (const node of sel) {
        if (node.type === "TEXT") {
            node.textAutoResize = "HEIGHT";
            node.textAlignVertical = "CENTER";
            count++;
        }
    }
    figma.ui.postMessage({ type: 'log', message: `📏 Выровнено ${count} текстов` });
}

async function handleTestUpload(token) {
    figma.ui.postMessage({ type: 'log', message: '🧪 Тест API...' });
    // Create dummy image data
    const array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    // Send to UI
    figma.ui.postMessage({ 
        type: 'upload-images', 
        images: [{ id: 'test', bytes: array, filename: 'test_pixel.png', hash: 'test' }],
        token: token 
    });
}

async function dumpSelectionDebug() {
    const node = figma.currentPage.selection[0];
    if(node) {
        console.log('Node Debug:', node);
        figma.ui.postMessage({ type: 'log', message: `Debug: ${node.name} (${node.type})` });
    }
}
