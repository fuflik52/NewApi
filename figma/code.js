const USE_NORMALIZED_ANCHORS = true;
const MIN_UI_SCALE = 0.5;
const MAX_UI_SCALE = 1.0;
const API_BASE = 'https://bublickrust.ru';
let currentApiToken = '';
let currentAssetMode = 'urls'; // 'urls' | 'data'
let currentAnchorMode = 'corners'; // 'corners' | 'center'
let currentTheme = 'cosmic'; // 'cosmic' | 'monokai'
// Scale is now managed inside the generated C# plugin (pers param 0.5..1.0)
let currentRootFrame = null;
let pendingUploadResolve = null; // Waiting for UI image upload completion

// Universal safe serialization function to prevent "Cannot unwrap symbol" errors
function safeSerialize(obj, visited = new WeakSet()) {
    // Handle null and undefined
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    // Handle primitives
    const objType = typeof obj;
    if (objType !== 'object' && objType !== 'function') {
        // Handle NaN and Infinity
        if (objType === 'number' && (isNaN(obj) || !isFinite(obj))) {
            return 0;
        }
        return obj;
    }
    
    // Skip functions and symbols immediately
    if (objType === 'function' || objType === 'symbol') {
        return undefined;
    }
    
    // Prevent circular references
    if (visited.has(obj)) {
        return null;
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
        visited.add(obj);
        try {
            return obj.map(item => safeSerialize(item, visited)).filter(item => item !== undefined);
        } catch (e) {
            console.warn('Array serialization error:', e);
            return [];
        } finally {
            visited.delete(obj);
        }
    }
    
    // Handle Uint8Array and other typed arrays
    if (obj instanceof Uint8Array) {
        return Array.from(obj);
    }
    if (obj instanceof ArrayBuffer) {
        return Array.from(new Uint8Array(obj));
    }
    
    // Handle Date
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    
    // Handle Map and Set (convert to plain objects/arrays)
    if (obj instanceof Map) {
        const result = {};
        try {
            for (const [key, value] of obj.entries()) {
                const serializedKey = safeSerialize(key, visited);
                const serializedValue = safeSerialize(value, visited);
                if (serializedKey !== undefined && serializedValue !== undefined) {
                    result[String(serializedKey)] = serializedValue;
                }
            }
        } catch (e) {
            console.warn('Map serialization error:', e);
        }
        return result;
    }
    
    if (obj instanceof Set) {
        try {
            return Array.from(obj).map(item => safeSerialize(item, visited)).filter(item => item !== undefined);
        } catch (e) {
            console.warn('Set serialization error:', e);
            return [];
        }
    }
    
    // Handle plain objects
    visited.add(obj);
    try {
        const result = {};
        // Use Object.keys to avoid Symbol properties
        const keys = Object.keys(obj);
        for (const key of keys) {
            try {
                const value = obj[key];
                
                // Skip functions and symbols
                if (typeof value === 'function' || typeof value === 'symbol') continue;
                
                // Skip figma.mixed
                if (value === figma.mixed) continue;
                
                const serialized = safeSerialize(value, visited);
                // Only add if serialization succeeded
                if (serialized !== undefined) {
                    result[key] = serialized;
                }
            } catch (e) {
                // Skip properties that can't be serialized
                console.warn(`Skipping property ${key} during serialization:`, e);
            }
        }
        return result;
    } catch (e) {
        console.warn('Object serialization error:', e);
        return {};
    } finally {
        visited.delete(obj);
    }
}

// Wrapper for postMessage that ensures safe serialization
function safePostMessage(message) {
    try {
        const serialized = safeSerialize(message);
        figma.ui.postMessage(serialized);
    } catch (error) {
        console.error('Serialization error:', error);
        // Fallback: send error message only
        try {
            figma.ui.postMessage({ 
                type: 'error', 
                message: `Serialization error: ${error.message}` 
            });
        } catch (fallbackError) {
            // Last resort: just log the error
            console.error('Failed to send error message:', fallbackError);
        }
    }
}

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

      safePostMessage({ 
        type: 'init', 
        token: currentApiToken,
        settings: { 
            assetMode: currentAssetMode, 
            anchorMode: currentAnchorMode,
            theme: currentTheme
        }
      });
      
      if (currentApiToken) safePostMessage({ type: 'log', message: `🔐 Токен загружен локально` });
    } 
    else if (msg.type === 'save-token') {
      currentApiToken = msg.apiToken || '';
      await figma.clientStorage.setAsync('apiToken', currentApiToken);
      safePostMessage({ type: 'log', message: '💾 Токен сохранён' });
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
        safePostMessage({ type: 'log', message: '⚙️ Настройки сохранены' });
    }
    else if (msg.type === 'generate-code') {
      if (typeof msg.apiToken === 'string') {
        currentApiToken = msg.apiToken;
        await figma.clientStorage.setAsync('apiToken', currentApiToken);
      }
      if (typeof msg.assetMode === 'string') {
        currentAssetMode = msg.assetMode === 'data' ? 'data' : 'urls';
        await figma.clientStorage.setAsync('assetMode', currentAssetMode);
        safePostMessage({ type: 'log', message: `🖼️ Режим ассетов: ${currentAssetMode}` });
      }
      if (typeof msg.anchorMode === 'string') {
        currentAnchorMode = msg.anchorMode === 'center' ? 'center' : 'corners';
        await figma.clientStorage.setAsync('anchorMode', currentAnchorMode);
        safePostMessage({ type: 'log', message: `📐 Режим генерации: ${currentAnchorMode === 'center' ? 'от центра' : 'по углам'}` });
      }

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
        // FIX: Return plain object, not Map, because getImageUrl uses object property access
        const map = results; 
        if (pendingUploadResolve) {
          pendingUploadResolve(map);
          pendingUploadResolve = null;
          safePostMessage({ type: 'log', message: '📋 Загрузка изображений завершена' });
        } else {
          safePostMessage({ type: 'log', message: '⚠️ Ответ upload-complete получен без ожидающего запроса' });
        }
      } catch (e) {
        safePostMessage({ type: 'error', message: `❌ Ошибка обработки upload-complete: ${e.message}` });
      }
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    } else if (msg.type === 'request-debug') {
      try {
        await dumpSelectionDebug();
      } catch (e) {
        safePostMessage({ type: 'error', message: `❌ Debug error: ${e.message}` });
      }
    } else if (msg.type === 'test-upload') {
      await handleTestUpload(msg.apiToken);
    } else if (msg.type === 'get-selection-context') {
      await handleGetSelectionContext();
    } else if (msg.type === 'load-json-data') {
      await handleLoadJSON(msg.data);
    } else if (msg.type === 'place-image') {
      await handlePlaceImage(msg.bytes, msg.name);
    } else if (msg.type === 'scan-design-system') {
      await handleScanDesignSystem();
    } else if (msg.type === 'scan-request') {
      handleScanRequest();
    } else if (msg.type === 'render-svg') {
      await handleRenderSvg(msg.svg);
    }
  } catch (error) {
    safePostMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
};

async function handleScanDesignSystem() {
    const node = figma.currentPage.selection[0] || figma.currentPage;
    const colors = new Set();
    const icons = [];
    
    function traverse(n) {
        if (!n) return;
        
        // Collect Colors (Solid Fills)
        if (n.fills && Array.isArray(n.fills)) {
            for (const fill of n.fills) {
                if (fill.type === 'SOLID' && fill.visible !== false) {
                    const hex = rgbToHex(fill.color);
                    // Optional: include opacity if needed
                    colors.add(hex.toUpperCase());
                }
            }
        }
        
        // Collect Icons (Vector paths)
        if (n.type === 'VECTOR' && n.vectorPaths && n.vectorPaths.length > 0) {
            // Simplified: just count them or store first path data to avoid huge payload
            // Or check if it looks like an icon (small size?)
            if (n.width <= 64 && n.height <= 64) {
                const pathData = n.vectorPaths[0];
                // Only serialize the data string, not the entire path object
                if (pathData && typeof pathData.data === 'string') {
                    icons.push({ name: n.name, path: pathData.data });
                }
            }
        }
        
        if (n.children) {
            for (const child of n.children) {
                traverse(child);
            }
        }
    }
    
    traverse(node);
    
    const uniqueColors = Array.from(colors).sort();
    const uniqueIcons = icons.slice(0, 20); // Limit to 20 icons to avoid overload
    
    safePostMessage({ 
        type: 'design-system-data', 
        data: { 
            colors: uniqueColors, 
            iconsCount: icons.length, 
            sampleIcons: uniqueIcons,
            rootName: node.name || 'Root'
        } 
    });
}

function rgbToHex(color) {
    const toHex = (v) => {
        const hex = Math.round(v * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(color.r) + toHex(color.g) + toHex(color.b);
}

async function handlePlaceImage(bytes, name) {
    try {
        const image = figma.createImage(bytes);
        const { width, height } = await image.getSizeAsync();
        
        const node = figma.createRectangle();
        node.name = name || "Image";
        node.resize(width, height);
        node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FIT' }];
        
        // Center in viewport
        node.x = figma.viewport.center.x - width / 2;
        node.y = figma.viewport.center.y - height / 2;
        
        figma.currentPage.appendChild(node);
        figma.currentPage.selection = [node];
        safePostMessage({ type: 'log', message: `✅ Изображение добавлено: ${name}` });
        
    } catch (e) {
        console.error(e);
        safePostMessage({ type: 'error', message: `❌ Ошибка добавления: ${e.message}` });
    }
}

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
    safePostMessage({ type: 'error', message: 'Выберите корневой Frame в Figma' });
    return;
  }

  setRootFrame(node);
  const frameName = node.name || 'Plugin';

  try {
    const elements = [];
    collectAllElements(node, elements);

    safePostMessage({ type: 'log', message: `📦 Фрейм: ${frameName} (${elements.length} элементов)` });

    const typeCounts = {};
    elements.forEach(el => {
      const type = el.type || 'UNKNOWN';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    if (Object.keys(typeCounts).length > 1) {
        let stats = [];
        for (const [type, count] of Object.entries(typeCounts)) stats.push(`${type}: ${count}`);
    }

    const imageMap = await uploadAllImages(node, currentApiToken);

    const cuiCode = generateRustCUI(node, imageMap);
    const csharpCode = generateCSharpCode(node, imageMap, currentAssetMode, currentAnchorMode);

    const fileKey = figma.fileKey || 'local_draft';
    const fileName = figma.root.name || 'Untitled';

    safePostMessage({ 
        type: 'code-generated', 
        cui: cuiCode, 
        csharp: csharpCode, 
        frameName: frameName, 
        fileKey: fileKey,
        fileName: fileName 
    });
    
    console.log('Generated Code for:', fileName, fileKey);
  } catch (error) {
    safePostMessage({ type: 'error', message: `❌ Ошибка: ${error.message}` });
  }
}

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

function generateRustCUI(node, imageMap) {
  const elements = [];
  traverseForCUI(node, elements, imageMap, 'root');

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

  if (hasImageFill(node, imageMap)) {
    const imageUrl = getImageUrl(node, imageMap);
    element.components = [{ type: 'UnityEngine.UI.RawImage', url: imageUrl, color: '1 1 1 1' }];
  } else if (node.type === 'TEXT') {
    element.components = [{ type: 'UnityEngine.UI.Text', text: node.characters || '', fontSize: node.fontSize || 14, color: getFillColor(node), align: getTextAlign(node) }];
  } else {
    element.components = [{ type: 'UnityEngine.UI.Image', color: getFillColor(node) || '1 1 1 0.5' }];
  }

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
            
            string rootName = LayerName;
            
            // Create a full-screen transparent overlay
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
            string contentName = rootName + ".Content";
            
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

            GenerateChildren(elements, contentName);

            CuiHelper.AddUi(player, elements);
        }

        private void GenerateChildren(CuiElementContainer elements, string parent)
        {
`;

  function processNode(node, parentVarName, parentBounds) {
    let localCode = "";
    
    if (!node.visible) return "";
    if (node.opacity === 0) return "";

    const isImage = hasImageFill(node, imageMap);
    const isText = node.type === "TEXT";
    
    const nX = node.x;
    const nY = node.y; 
    
    const pW = parentBounds.width;
    const pH = parentBounds.height;
    
    if (pW === 0 || pH === 0) return "";

    let aMinX = nX / pW;
    let aMaxX = (nX + node.width) / pW;
    let aMinY = (pH - (nY + node.height)) / pH;
    let aMaxY = (pH - nY) / pH;
    
    aMinX = parseFloat(aMinX.toFixed(4));
    aMaxX = parseFloat(aMaxX.toFixed(4));
    aMinY = parseFloat(aMinY.toFixed(4));
    aMaxY = parseFloat(aMaxY.toFixed(4));
    
    const uniqueName = sanitizeClassName(node.name) + "_" + Math.floor(Math.random() * 10000);
    
    localCode += `            // ${node.name} (${node.type})\n`;
    
    if (isImage) {
        const url = getImageUrl(node, imageMap);
        const color = getFillColor(node);
        
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
    else if (isText) {
        const text = (node.characters || "").replace(/"/g, '\\"').replace(/\n/g, "\\n");
        const fontSize = Math.round(node.fontSize || 14);
        const color = getFillColor(node);
        const align = getTextAlign(node);
        const font = "RobotoCondensed-Bold.ttf";
        
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
    else {
        const color = getFillColor(node);
        
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
    
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            localCode += processNode(child, `"${uniqueName}"`, { width: node.width, height: node.height });
        }
    }
    
    return localCode;
  }

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

function sanitizeClassName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, "");
}

function hasImageFill(node, imageMap) {
  if (imageMap[node.id]) return true;
  if (!node.fills) return false;
  for (const fill of node.fills) {
    if (fill.visible !== false && fill.type === 'IMAGE') return true;
  }
  return false;
}

function getImageUrl(node, imageMap) {
  if (imageMap && imageMap[node.id]) return imageMap[node.id];
  console.log(`⚠️ URL для изображения ${node.name} не найден.`);
  return "";
}

function getFillColor(node) {
  if (!node.fills || node.fills.length === 0) return "0 0 0 0";
  const fill = node.fills[node.fills.length - 1];
  if (fill.visible === false) return "0 0 0 0";
  
  if (fill.type === 'SOLID') {
    const r = fill.color.r.toFixed(2);
    const g = fill.color.g.toFixed(2);
    const b = fill.color.b.toFixed(2);
    const a = (fill.opacity !== undefined ? fill.opacity : 1).toFixed(2);
    return `${r} ${g} ${b} ${a}`;
  }
  return "1 1 1 1";
}

function getTextAlign(node) {
  if (!node.textAlignHorizontal) return "MiddleCenter";
  
  const h = node.textAlignHorizontal;
  const v = node.textAlignVertical || "TOP";
  
  let sH = "Middle";
  if (h === "LEFT") sH = "Left";
  if (h === "RIGHT") sH = "Right";
  
  let sV = "Center";
  if (v === "TOP") sV = "Upper";
  if (v === "BOTTOM") sV = "Lower";
  
  return `${sH}${sV}`.replace("MiddleUpper", "UpperCenter").replace("MiddleLower", "LowerCenter").replace("MiddleLeft", "MiddleLeft").replace("MiddleRight", "MiddleRight").replace("MiddleCenter", "MiddleCenter");
}

async function uploadAllImages(rootNode, token) {
  const imageMap = {};
  const nodesToProcess = [];
  
  function findImages(node) {
    if (!node.visible) return;
    
    if (node.exportSettings && node.exportSettings.length > 0) {
        nodesToProcess.push(node);
        return;
    }
    
    if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") {
         nodesToProcess.push(node);
         return;
    }
    
    if (node.fills) {
        for (const fill of node.fills) {
            if (fill.type === 'IMAGE' && fill.visible !== false) {
                nodesToProcess.push(node);
                return;
            }
        }
    }
    
    if (node.children) {
        for (const child of node.children) findImages(child);
    }
  }
  
  findImages(rootNode);
  
  if (nodesToProcess.length === 0) return {};

  safePostMessage({ type: 'log', message: `📸 Обработка ${nodesToProcess.length} изображений...` });

  const imagesData = [];
  
  for (const node of nodesToProcess) {
      try {
          const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
          imagesData.push({
              id: node.id,
              bytes: Array.from(bytes), // Convert Uint8Array to Array for postMessage
              hash: node.id,
              filename: (node.name || 'image').replace(/[^a-z0-9]/gi, '_') + '.png'
          });
      } catch (e) {
          console.error("Export failed", e);
      }
  }
  
  if (imagesData.length === 0) return {};

  return new Promise((resolve) => {
      pendingUploadResolve = resolve;
      safePostMessage({ 
          type: 'upload-images', 
          images: imagesData,
          token: token 
      });
      safePostMessage({ type: 'cache-images', images: imagesData });
  });
}

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
    safePostMessage({ type: 'log', message: `🔠 Обновлено ${count} текстовых слоев` });
}

async function alignTextToRectangles() {
    safePostMessage({ type: 'log', message: '⚠️ Функция в разработке' });
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
    safePostMessage({ type: 'log', message: `📏 Выровнено ${count} текстов` });
}

async function handleTestUpload(token) {
    safePostMessage({ type: 'log', message: '🧪 Тест API...' });
    const array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    safePostMessage({ 
        type: 'upload-images', 
        images: [{ id: 'test', bytes: Array.from(array), filename: 'test_pixel.png', hash: 'test' }],
        token: token 
    });
}

async function dumpSelectionDebug() {
    const node = figma.currentPage.selection[0];
    if(node) {
        console.log('Node Debug:', node);
        safePostMessage({ type: 'log', message: `Debug: ${node.name} (${node.type})` });
    }
}

async function handleGetSelectionContext() {
    const node = figma.currentPage.selection[0];
    if (!node) {
        safePostMessage({ type: 'error', message: 'Ничего не выбрано' });
        return;
    }

    function serializeNode(n) {
        // Helper to safely serialize numbers (avoid NaN, Infinity)
        const safeNumber = (val) => {
            if (typeof val !== 'number') return val;
            if (isNaN(val) || !isFinite(val)) return 0;
            return val;
        };
        
        const nodeData = {
            id: n.id,
            name: n.name || '',
            type: n.type,
            visible: n.visible !== undefined ? n.visible : true,
            opacity: safeNumber(n.opacity !== undefined ? n.opacity : 1),
            width: safeNumber(n.width),
            height: safeNumber(n.height),
            x: safeNumber(n.x),
            y: safeNumber(n.y),
        };

        if (n.fills && n.fills !== figma.mixed && Array.isArray(n.fills)) {
            nodeData.fills = n.fills.map(f => {
                if(f.type === 'SOLID') {
                    return { 
                        type: 'SOLID', 
                        color: f.color || {r:0, g:0, b:0}, 
                        opacity: safeNumber(f.opacity !== undefined ? f.opacity : 1)
                    };
                }
                if(f.type === 'IMAGE') {
                    return { type: 'IMAGE', scaleMode: f.scaleMode || 'FILL' };
                }
                return { type: f.type || 'UNKNOWN' };
            }).filter(f => f); // Remove any null/undefined entries
        }

        if (n.strokes && n.strokes !== figma.mixed && Array.isArray(n.strokes)) {
            nodeData.strokes = n.strokes.map(s => ({ 
                type: s.type || 'SOLID', 
                color: s.color || {r:0, g:0, b:0} 
            })).filter(s => s);
            if (n.strokeWeight !== undefined) {
                nodeData.strokeWeight = safeNumber(n.strokeWeight);
            }
        }

        if (n.effects && n.effects !== figma.mixed && Array.isArray(n.effects)) {
            nodeData.effects = n.effects.map(e => ({ 
                type: e.type || 'DROP_SHADOW', 
                visible: e.visible !== false, 
                radius: safeNumber(e.radius || 0)
            })).filter(e => e);
        }

        if (n.type === 'TEXT') {
            nodeData.characters = (n.characters ? String(n.characters).substring(0, 100) : '') || '';
            if (n.fontSize !== undefined) {
                nodeData.fontSize = safeNumber(n.fontSize);
            }
            // Serialize fontName properly (avoid figma.mixed and non-serializable properties)
            if (n.fontName && n.fontName !== figma.mixed && typeof n.fontName === 'object') {
                try {
                    nodeData.fontName = {
                        family: String(n.fontName.family || 'Inter'),
                        style: String(n.fontName.style || 'Regular')
                    };
                } catch (e) {
                    // Skip fontName if serialization fails
                }
            }
            if (n.textAlignHorizontal) {
                nodeData.textAlignHorizontal = String(n.textAlignHorizontal);
            }
            if (n.textAlignVertical) {
                nodeData.textAlignVertical = String(n.textAlignVertical);
            }
        }

        if (n.cornerRadius !== undefined && n.cornerRadius !== figma.mixed) {
            nodeData.cornerRadius = safeNumber(n.cornerRadius);
        }

        if (n.layoutMode) {
            nodeData.layoutMode = String(n.layoutMode);
            if (n.primaryAxisAlignItems) {
                nodeData.primaryAxisAlignItems = String(n.primaryAxisAlignItems);
            }
            if (n.counterAxisAlignItems) {
                nodeData.counterAxisAlignItems = String(n.counterAxisAlignItems);
            }
            if (n.itemSpacing !== undefined) {
                nodeData.itemSpacing = safeNumber(n.itemSpacing);
            }
            if (n.paddingLeft !== undefined) {
                nodeData.paddingLeft = safeNumber(n.paddingLeft);
            }
            if (n.paddingRight !== undefined) {
                nodeData.paddingRight = safeNumber(n.paddingRight);
            }
            if (n.paddingTop !== undefined) {
                nodeData.paddingTop = safeNumber(n.paddingTop);
            }
            if (n.paddingBottom !== undefined) {
                nodeData.paddingBottom = safeNumber(n.paddingBottom);
            }
        }

        if (n.children) {
            nodeData.children = n.children.map(child => serializeNode(child));
        }

        return nodeData;
    }

    const fullTree = serializeNode(node);
    safePostMessage({ type: 'selection-context', data: fullTree });
}

async function handleLoadJSON(data) {
    if (!data) {
        safePostMessage({ type: 'error', message: 'Пустые данные JSON' });
        return;
    }
    
    safePostMessage({ type: 'log', message: '🚀 Начало загрузки...' });
    
    try {
        let rootNode;
        
        // Handle Special "Game Menu" format (123.js)
        if (data.title && data.categories && data.kits) {
            safePostMessage({ type: 'log', message: '🎮 Обнаружен формат Game Menu...' });
            rootNode = await createGameMenuFromJSON(data);
        }
        // Standard Figma JSON
        else if (Array.isArray(data)) {
            rootNode = await createNodeFromData(data[0]);
        } else {
            rootNode = await createNodeFromData(data);
        }
        
        if (rootNode) {
            figma.currentPage.appendChild(rootNode);
            figma.currentPage.selection = [rootNode];
            figma.viewport.scrollAndZoomIntoView([rootNode]);
            safePostMessage({ type: 'log', message: '✅ Загрузка завершена успешно!' });
        } else {
            safePostMessage({ type: 'error', message: 'Не удалось создать корневой элемент' });
        }
        
    } catch (e) {
        console.error(e);
        safePostMessage({ type: 'error', message: `❌ Ошибка загрузки: ${e.message}` });
    }
}

function normalizeSvgPath(path) {
    // Add space before commands if missing (e.g., "M2" -> "M 2", "L3" -> "L 3")
    // and ensure space between coordinates if they are stuck together unexpectedly, though regex below handles commands
    return path.replace(/([a-zA-Z])/g, ' $1 ').replace(/\s+/g, ' ').trim();
}

async function createGameMenuFromJSON(data) {
    const theme = data.theme || {};
    
    // 1. Main Frame (Background)
    const frame = figma.createFrame();
    frame.name = "GameMenu";
    frame.resize(1920, 1080);
    frame.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.05 } }]; // #0D0D0D
    
    // Load Fonts
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });

    // 2. Header
    const headerGroup = figma.createFrame();
    headerGroup.name = "Header";
    headerGroup.fills = []; // Transparent
    headerGroup.layoutMode = "HORIZONTAL";
    headerGroup.itemSpacing = 8;
    headerGroup.counterAxisAlignItems = "CENTER";
    headerGroup.x = 100;
    headerGroup.y = 80;
    
    const titleText = figma.createText();
    titleText.characters = data.title || "MENU";
    titleText.fontSize = 48;
    titleText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    
    const highlightText = figma.createText();
    highlightText.characters = data.highlightText || "";
    highlightText.fontSize = 48;
    // Parse HEX color for highlight
    const hColorObj = parseColor(data.highlightColor || "#CE422B");
    highlightText.fills = [{ type: 'SOLID', color: hColorObj.color, opacity: hColorObj.opacity }];
    
    headerGroup.appendChild(titleText);
    headerGroup.appendChild(highlightText);
    frame.appendChild(headerGroup);
    
    // 3. Categories (Left Column)
    const categoriesFrame = figma.createFrame();
    categoriesFrame.name = "Categories";
    categoriesFrame.layoutMode = "VERTICAL";
    categoriesFrame.itemSpacing = 12;
    categoriesFrame.fills = [];
    categoriesFrame.x = 100;
    categoriesFrame.y = 200;
    
    // Header "CATEGORIES"
    const catHeader = figma.createText();
    catHeader.characters = data.categoriesHeader || "KATEGORII";
    catHeader.fontSize = 14;
    catHeader.opacity = 0.5;
    catHeader.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    categoriesFrame.appendChild(catHeader);
    
    // Category Buttons
    for (const cat of data.categories) {
        const btn = figma.createFrame();
        btn.name = `Btn_${cat.name}`;
        btn.resize(theme.buttonWidth || 200, theme.buttonHeight || 50);
        btn.cornerRadius = 4;
        
        // Gradient BG logic
        const gStartObj = parseColor(theme.categoryBgGradientStart || "#1A1A1A");
        const gEndObj = parseColor(theme.categoryBgGradientEnd || "#252525");
        
        // Use Object.assign instead of spread
        btn.fills = [{
            type: 'GRADIENT_LINEAR',
            gradientStops: [
                { position: 0, color: Object.assign({}, gStartObj.color, { a: gStartObj.opacity }) },
                { position: 1, color: Object.assign({}, gEndObj.color, { a: gEndObj.opacity }) }
            ],
            gradientTransform: [[1, 0, 0], [0, 1, 0]] // Vertical
        }];
        
        // Stroke/Glow if active
        if (cat.active) {
            btn.strokes = [{ type: 'SOLID', color: hColorObj.color, opacity: hColorObj.opacity }];
            btn.strokeWeight = 1;
        } else {
            btn.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.05 }];
        }
        
        // Layout inside button
        btn.layoutMode = "HORIZONTAL";
        btn.primaryAxisAlignItems = "SPACE_BETWEEN";
        btn.counterAxisAlignItems = "CENTER";
        btn.paddingLeft = 16;
        btn.paddingRight = 16;
        
        // Left part: Indicator + Name
        const leftPart = figma.createFrame();
        leftPart.name = "Left";
        leftPart.layoutMode = "HORIZONTAL";
        leftPart.itemSpacing = 12;
        leftPart.counterAxisAlignItems = "CENTER";
        leftPart.fills = [];
        
        // Icon (Vector from Path)
        if (cat.icon) {
            const vector = figma.createVector();
            try {
                vector.vectorPaths = [{
                    windingRule: "NONZERO",
                    data: normalizeSvgPath(cat.icon)
                }];
            } catch (e) {
                console.warn("Invalid vector path:", cat.icon);
                // Fallback to rectangle if path fails
            }
            vector.resize(20, 20);
            vector.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: cat.active ? 1 : 0.5 }];
            leftPart.appendChild(vector);
        }
        
        const nameTxt = figma.createText();
        nameTxt.characters = cat.name;
        nameTxt.fontSize = 14;
        nameTxt.fontName = { family: "Inter", style: cat.active ? "Bold" : "Medium" };
        nameTxt.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: cat.active ? 1 : 0.7 }];
        leftPart.appendChild(nameTxt);
        
        btn.appendChild(leftPart);
        
        // Status (Right side)
        if (cat.status) {
            const statusTxt = figma.createText();
            statusTxt.characters = cat.status;
            statusTxt.fontSize = 10;
            const statusColor = parseColor(cat.indicator || "#999");
            statusTxt.fills = [{ type: 'SOLID', color: statusColor.color, opacity: statusColor.opacity }];
            btn.appendChild(statusTxt);
        }
        
        categoriesFrame.appendChild(btn);
    }
    
    frame.appendChild(categoriesFrame);
    
    // 4. Kits Grid (Right Area)
    const kitsHeader = figma.createText();
    kitsHeader.characters = data.kitsHeader || "KITS";
    kitsHeader.fontSize = 14;
    kitsHeader.opacity = 0.5;
    kitsHeader.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    kitsHeader.x = 350;
    kitsHeader.y = 200;
    frame.appendChild(kitsHeader);
    
    const gridFrame = figma.createFrame();
    gridFrame.name = "KitsGrid";
    gridFrame.x = 350;
    gridFrame.y = 230;
    gridFrame.fills = [];
    // Simple grid simulation with AutoLayout
    gridFrame.layoutMode = "HORIZONTAL";
    gridFrame.layoutWrap = "WRAP"; // Support wrapping
    gridFrame.primaryAxisAlignItems = "MIN"; // Align left
    gridFrame.counterAxisAlignItems = "MIN"; // Align top
    gridFrame.itemSpacing = 16;
    gridFrame.counterAxisSpacing = 16;
    gridFrame.resize(800, 600); // Constraint width
    
    for (const kit of data.kits) {
        const card = figma.createFrame();
        card.name = `Kit_${kit.name}`;
        card.resize(240, 140);
        card.cornerRadius = 12;
        
        const kbColor = parseColor(theme.kitBgColor || "#2A2A2A");
        card.fills = [{ type: 'SOLID', color: kbColor.color, opacity: kbColor.opacity }];
        
        const kBorderColor = parseColor(theme.kitBorderColor || "rgba(255,255,255,0.05)");
        card.strokes = [{ type: 'SOLID', color: kBorderColor.color, opacity: kBorderColor.opacity }];
        
        // Layout
        card.layoutMode = "VERTICAL";
        card.paddingTop = 20;
        card.paddingBottom = 20;
        card.paddingLeft = 20;
        card.paddingRight = 20;
        card.itemSpacing = 16;
        card.primaryAxisAlignItems = "CENTER";
        card.counterAxisAlignItems = "CENTER";
        
        // Icon
        if (kit.icon) {
            const kVector = figma.createVector();
            try {
                kVector.vectorPaths = [{ windingRule: "NONZERO", data: normalizeSvgPath(kit.icon) }];
            } catch (e) {
                console.warn("Invalid kit icon path:", kit.icon);
            }
            // Scale icon to fit 48x48 roughly
            const scale = 2; // Paths seem small (24px base)
            kVector.resize(48, 48); // This might distort if path isn't square, better scale matrix
            // Or just creating it inside a frame
            
            // Let's just assume fit
            const kIconColor = parseColor(kit.indicator || "#fff");
            kVector.fills = [{ type: 'SOLID', color: kIconColor.color, opacity: kIconColor.opacity }];
            card.appendChild(kVector);
        }
        
        const kName = figma.createText();
        kName.characters = kit.name;
        kName.fontSize = 16;
        kName.fontName = { family: "Inter", style: "Bold" };
        kName.fills = [{ type: 'SOLID', color: {r:1,g:1,b:1} }];
        card.appendChild(kName);
        
        // Status
        const kStatus = figma.createText();
        kStatus.characters = kit.status;
        kStatus.fontSize = 12;
        kStatus.fills = [{ type: 'SOLID', color: {r:1,g:1,b:1}, opacity: 0.5 }];
        card.appendChild(kStatus);
        
        gridFrame.appendChild(card);
    }
    
    frame.appendChild(gridFrame);
    
    return frame;
}

function parseColor(str) {
    str = str || "#000000";
    
    // Handle rgba(r, g, b, a)
    if (str.trim().startsWith("rgba")) {
        const parts = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d\.]+))?\)/);
        if (parts) {
            return {
                color: {
                    r: parseInt(parts[1]) / 255,
                    g: parseInt(parts[2]) / 255,
                    b: parseInt(parts[3]) / 255
                },
                opacity: parts[4] !== undefined ? parseFloat(parts[4]) : 1
            };
        }
    }
    
    // Handle hex
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(str);
    return result ? {
        color: {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        },
        opacity: 1
    } : { color: { r: 0, g: 0, b: 0 }, opacity: 1 };
}

function hexToRgb(hex) {
    return parseColor(hex).color;
}

async function createNodeFromData(data) {
    let node;
    
    switch (data.type) {
        case 'FRAME':
            node = figma.createFrame();
            break;
        case 'RECTANGLE':
            node = figma.createRectangle();
            break;
        case 'ELLIPSE':
            node = figma.createEllipse();
            break;
        case 'TEXT':
            node = figma.createText();
            break;
        case 'GROUP':
            // Fallback to Frame for simplicity
            node = figma.createFrame(); 
            // Groups usually don't have fills, so make it transparent if needed
            if (!data.fills) node.fills = []; 
            break;
        default:
            // Fallback
            console.warn('Unknown type:', data.type);
            node = figma.createRectangle();
            node.name = `[${data.type}] ${data.name || 'Node'}`;
            break;
    }
    
    if (!node) return null;
    
    // Basic Props
    if (data.name) node.name = data.name;
    if (data.visible !== undefined) node.visible = data.visible;
    if (data.opacity !== undefined) node.opacity = data.opacity;
    
    // Geometry
    if (data.width && data.height) {
        node.resize(data.width, data.height);
    }
    if (data.x !== undefined && data.y !== undefined) {
        node.x = data.x;
        node.y = data.y;
    }
    
    // Styling: Fills
    if (data.fills && Array.isArray(data.fills)) {
        const paints = [];
        for (const f of data.fills) {
            if (f.type === 'SOLID') {
                paints.push({
                    type: 'SOLID',
                    color: f.color || {r:0, g:0, b:0},
                    opacity: f.opacity !== undefined ? f.opacity : 1,
                    visible: true
                });
            } else if (f.type === 'IMAGE') {
                // Placeholder for image loading (complex to restore)
                paints.push({
                    type: 'SOLID',
                    color: {r:0.8, g:0.8, b:0.8},
                    opacity: 1
                });
            }
        }
        node.fills = paints;
    }
    
    // Styling: Strokes
    if (data.strokes && Array.isArray(data.strokes)) {
        const strokes = [];
        for (const s of data.strokes) {
            if (s.type === 'SOLID') {
                strokes.push({
                    type: 'SOLID',
                    color: s.color || {r:0, g:0, b:0},
                    opacity: 1
                });
            }
        }
        node.strokes = strokes;
        if (data.strokeWeight) node.strokeWeight = data.strokeWeight;
    }
    
    // Corner Radius
    if (data.cornerRadius !== undefined && node.cornerRadius !== undefined) {
        node.cornerRadius = data.cornerRadius;
    }
    
    // Effects (Shadows)
    if (data.effects && Array.isArray(data.effects)) {
        node.effects = data.effects.map(e => ({
            type: e.type,
            color: {r:0, g:0, b:0, a:0.25},
            offset: {x:0, y:4},
            radius: e.radius || 4,
            visible: e.visible !== false
        }));
    }
    
    // Text Specific
    if (data.type === 'TEXT' && data.characters) {
        try {
            const font = data.fontName || { family: "Inter", style: "Regular" };
            await figma.loadFontAsync(font).catch(async () => {
                await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            });
            
            node.characters = data.characters;
            if (data.fontSize) node.fontSize = data.fontSize;
            if (data.textAlignHorizontal) node.textAlignHorizontal = data.textAlignHorizontal;
            if (data.textAlignVertical) node.textAlignVertical = data.textAlignVertical;
            
        } catch (e) {
            console.error('Font error', e);
        }
    }
    
    // Children (Recursive)
    if (data.children && Array.isArray(data.children) && (node.type === 'FRAME' || node.type === 'GROUP')) {
        for (const childData of data.children) {
            const childNode = await createNodeFromData(childData);
            if (childNode) {
                node.appendChild(childNode);
            }
        }
    }
    
    return node;
}

// --- AI REDESIGN HELPERS ---

function scanNode(node) {
    let data = [];
    
    // Helper to safely serialize numbers
    const safeNumber = (val) => {
        if (typeof val !== 'number') return val;
        if (isNaN(val) || !isFinite(val)) return 0;
        return val;
    };
    
    if (node.type === 'TEXT') {
        data.push({
            type: 'TEXT',
            name: String(node.name || ''),
            text: String(node.characters || ''),
            x: safeNumber(node.x),
            y: safeNumber(node.y)
        });
    } 
    else if ('children' in node) {
        for (const child of node.children) {
            data = data.concat(scanNode(child));
        }
    }
    else {
        data.push({
            type: String(node.type || 'UNKNOWN'),
            name: String(node.name || ''),
            x: safeNumber(node.x),
            y: safeNumber(node.y)
        });
    }
    return data;
}

function handleScanRequest() {
    const selection = figma.currentPage.selection;
    
    if (selection.length === 0) {
        safePostMessage({ type: 'error', message: 'Please select a Frame first.' });
        return;
    }

    const node = selection[0];
    
    const contextData = {
        name: node.name,
        width: node.width,
        height: node.height,
        elements: scanNode(node)
    };

    safePostMessage({ type: 'context-data', data: contextData });
}

async function handleRenderSvg(svgCode) {
    try {
        const node = figma.createNodeFromSvg(svgCode);
        
        // Center in viewport
        node.x = figma.viewport.center.x;
        node.y = figma.viewport.center.y;
        
        figma.currentPage.selection = [node];
        
        // Load basic font to ensure text renders
        await figma.loadFontAsync({ family: "Roboto", style: "Regular" }).catch(() => {});
        await figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => {});
        
        figma.notify("Design generated successfully!");
    } catch (err) {
        figma.notify("Error creating SVG: " + err.toString());
        safePostMessage({ type: 'error', message: "SVG Error: " + err.toString() });
    }
}
