using Oxide.Core;
using Oxide.Core.Plugins;
using Oxide.Game.Rust.Cui;
using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Oxide.Plugins
{
    [Info("PanbpUI", "BublickRust", "1.0.0")]
    [Description("Auto-generated UI from Figma")]
    class PanbpUI : RustPlugin
    {
        private class UIAssetsLoader
        {
            private readonly Dictionary<string, string> _ids = new Dictionary<string, string>();
            private readonly string _pluginName;
            private readonly PanbpUI _plugin;
            private readonly HashSet<string> _missingLogged = new HashSet<string>();
            private bool _cancel;
            public int Requested { get; private set; }
            public int Loaded { get; private set; }
            public int Failed { get; private set; }
            public UIAssetsLoader(string pluginName, PanbpUI plugin) { _pluginName = pluginName; _plugin = plugin; }
            public void StartLoad(IEnumerable<string> keys) { _cancel = false; ServerMgr.Instance.StartCoroutine(LoadRoutine(keys)); }
            public void Cancel() { _cancel = true; }
            private System.Collections.IEnumerator LoadRoutine(IEnumerable<string> keys)
            {
                foreach (var key in keys)
                {
                    if (_cancel) yield break;
                    var path = $"file://{Interface.Oxide.DataDirectory}/{_pluginName}/Images/{key}.png";
                    using (var req = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(path))
                    {
                        Requested++;
                        yield return req.SendWebRequest();
                        if (req.result == UnityEngine.Networking.UnityWebRequest.Result.ConnectionError || req.result == UnityEngine.Networking.UnityWebRequest.Result.ProtocolError)
                        {
                            Failed++;
                            _plugin?.PrintWarning($"[UIAssets] Not found or failed: '{key}' => {path} ({req.error})");
                        }
                        else
                        {
                            var tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(req);
                            if (tex != null)
                            {
                                var bytes = tex.EncodeToPNG();
                                var id = FileStorage.server.Store(bytes, FileStorage.Type.png, CommunityEntity.ServerInstance.net.ID).ToString();
                                _ids[key] = id;
                                Loaded++;
                                UnityEngine.Object.DestroyImmediate(tex);
                            }
                            else { Failed++; }
                        }
                    }
                    yield return null;
                }
                _plugin?.Puts($"[UIAssets] Requested: {Requested}, Loaded: {Loaded}, Failed: {Failed}");
            }
            public string Get(string key)
            {
                if (_ids.TryGetValue(key, out var id)) return id;
                if (_missingLogged.Add(key)) _plugin?.PrintWarning($"[UIAssets] Png id for key '{key}' is missing. Place file at data/{_pluginName}/Images/{key}.png");
                return null;
            }
        }
        private UIAssetsLoader assets = null;
        private const string UIName = "Panbp";
        private const float MinScale = 0.5f;
        private const float MaxScale = 1.0f;
        private const float DefaultScale = 0.67f;
        private const float DesignWidth = 1920f;
        private const float DesignHeight = 1080f;
        private readonly HashSet<ulong> playersWithUI = new HashSet<ulong>();
        private readonly Dictionary<ulong, float> playerScale = new Dictionary<ulong, float>();

        private float GetScale(BasePlayer player)
        {
            if (player == null) return DefaultScale;
            float s;
            if (playerScale.TryGetValue(player.userID, out s)) return Mathf.Clamp(s, MinScale, MaxScale);
            return DefaultScale;
        }

        private void SetScale(BasePlayer player, float value)
        {
            if (player == null) return;
            var clamped = Mathf.Clamp(value, MinScale, MaxScale);
            playerScale[player.userID] = clamped;
        }

        [ChatCommand("panbp")]
        void CmdToggleUI(BasePlayer player, string command, string[] args)
        {
            if (args != null && args.Length > 0)
            {
                var sub = (args[0] ?? string.Empty).ToLowerInvariant();
                if (sub == "scale" || sub == "s")
                {
                    if (args.Length < 2)
                    {
                        var cur = GetScale(player);
                        player.ChatMessage($"Текущий масштаб UI: {cur:0.00} (мин {MinScale:0.00}, макс {MaxScale:0.00})");
                        return;
                    }
                    float v;
                    if (!float.TryParse(args[1], NumberStyles.Float, CultureInfo.InvariantCulture, out v))
                    {
                        player.ChatMessage("Некорректное число. Пример: /panbp scale 0.85");
                        return;
                    }
                    SetScale(player, v);
                    if (HasUI(player)) ShowUI(player); else ShowUI(player);
                    return;
                }
                if (sub == "bigger" || sub == "+")
                {
                    SetScale(player, GetScale(player) + 0.05f);
                    if (HasUI(player)) ShowUI(player); else ShowUI(player);
                    return;
                }
                if (sub == "smaller" || sub == "-")
                {
                    SetScale(player, GetScale(player) - 0.05f);
                    if (HasUI(player)) ShowUI(player); else ShowUI(player);
                    return;
                }
            }
            if (HasUI(player)) CloseUI(player); else ShowUI(player);
        }

        [ConsoleCommand("panbp.scale")]
        void CmdScale(ConsoleSystem.Arg arg)
        {
            var player = arg?.Player();
            if (player == null) return;
            var s = arg.GetFloat(0, GetScale(player));
            SetScale(player, s);
            if (HasUI(player)) ShowUI(player); else ShowUI(player);
        }

        private bool HasUI(BasePlayer player) { return playersWithUI.Contains(player.userID); }

        private void ShowUI(BasePlayer player)
        {
            CloseUI(player);
            playersWithUI.Add(player.userID);

            var elements = new CuiElementContainer();
            var scale = GetScale(player);
            if (assets == null) { Puts("[UI] Warning: assets loader is not initialized yet. Images may be missing."); }
            elements.Add(new CuiPanel
            {
                Image = { Color = "0 0 0 0" },
                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "0 0", OffsetMax = "0 0" },
                CursorEnabled = false,
                FadeOut = 0.1f
            }, "Overlay", UIName);

            var s = Mathf.Clamp(scale, MinScale, MaxScale);
            Puts($"[PanbpUI] ShowUI для игрока {player.displayName}, Scale={s:0.00}");

                    // Panel: Rectangle 18
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-26 * s)} {Mathf.RoundToInt(-168 * s)}", OffsetMax = $"{Mathf.RoundToInt(50 * s)} {Mathf.RoundToInt(-157 * s)}" }
                    }, UIName, "group_110_rectangle_18_0");

                    // Panel: Rectangle 19
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.443 0.545 0.267 1.000" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-228 * s)} {Mathf.RoundToInt(-168 * s)}", OffsetMax = $"{Mathf.RoundToInt(-71 * s)} {Mathf.RoundToInt(-157 * s)}" }
                    }, UIName, "group_110_rectangle_19_1");

                    // Panel: Rectangle 14
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.443 0.545 0.267 1.000" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-66 * s)} {Mathf.RoundToInt(-180 * s)}", OffsetMax = $"{Mathf.RoundToInt(-31 * s)} {Mathf.RoundToInt(-145 * s)}" }
                    }, UIName, "group_108_rectangle_14_0");

                    // Text: 1
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "1", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(20 * s)), Align = TextAnchor.UpperCenter, Color = "0.745 0.855 0.561 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-54 * s)} {Mathf.RoundToInt(-178 * s)}", OffsetMax = $"{Mathf.RoundToInt(-43 * s)} {Mathf.RoundToInt(-148 * s)}" }
                    }, UIName);

                    // Panel: Rectangle 26
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(95 * s)} {Mathf.RoundToInt(-168 * s)}", OffsetMax = $"{Mathf.RoundToInt(171 * s)} {Mathf.RoundToInt(-157 * s)}" }
                    }, UIName, "group_112_rectangle_26_0");

                    // Panel: Rectangle 14
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(55 * s)} {Mathf.RoundToInt(-180 * s)}", OffsetMax = $"{Mathf.RoundToInt(90 * s)} {Mathf.RoundToInt(-145 * s)}" }
                    }, UIName, "group_109_rectangle_14_0");

                    // Text: 3
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "3", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(20 * s)), Align = TextAnchor.UpperCenter, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(67 * s)} {Mathf.RoundToInt(-178 * s)}", OffsetMax = $"{Mathf.RoundToInt(78 * s)} {Mathf.RoundToInt(-148 * s)}" }
                    }, UIName);

                    // Panel: Rectangle 26
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(216 * s)} {Mathf.RoundToInt(-168 * s)}", OffsetMax = $"{Mathf.RoundToInt(292 * s)} {Mathf.RoundToInt(-157 * s)}" }
                    }, UIName, "group_113_rectangle_26_0");

                    // Panel: Rectangle 14
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(176 * s)} {Mathf.RoundToInt(-180 * s)}", OffsetMax = $"{Mathf.RoundToInt(211 * s)} {Mathf.RoundToInt(-145 * s)}" }
                    }, UIName, "group_109_rectangle_14_0");

                    // Text: 4
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "4", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(20 * s)), Align = TextAnchor.UpperCenter, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(188 * s)} {Mathf.RoundToInt(-178 * s)}", OffsetMax = $"{Mathf.RoundToInt(199 * s)} {Mathf.RoundToInt(-148 * s)}" }
                    }, UIName);

                    // Panel: Rectangle 26
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(337 * s)} {Mathf.RoundToInt(-168 * s)}", OffsetMax = $"{Mathf.RoundToInt(413 * s)} {Mathf.RoundToInt(-157 * s)}" }
                    }, UIName, "group_114_rectangle_26_0");

                    // Panel: Rectangle 14
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(297 * s)} {Mathf.RoundToInt(-180 * s)}", OffsetMax = $"{Mathf.RoundToInt(332 * s)} {Mathf.RoundToInt(-145 * s)}" }
                    }, UIName, "group_109_rectangle_14_0");

                    // Text: 5
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "5", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(20 * s)), Align = TextAnchor.UpperCenter, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(309 * s)} {Mathf.RoundToInt(-178 * s)}", OffsetMax = $"{Mathf.RoundToInt(320 * s)} {Mathf.RoundToInt(-148 * s)}" }
                    }, UIName);

                    // Panel: Rectangle 26
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(458 * s)} {Mathf.RoundToInt(-168 * s)}", OffsetMax = $"{Mathf.RoundToInt(493 * s)} {Mathf.RoundToInt(-157 * s)}" }
                    }, UIName, "group_115_rectangle_26_0");

                    // Panel: Rectangle 14
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(418 * s)} {Mathf.RoundToInt(-180 * s)}", OffsetMax = $"{Mathf.RoundToInt(453 * s)} {Mathf.RoundToInt(-145 * s)}" }
                    }, UIName, "group_109_rectangle_14_0");

                    // Text: 6
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "6", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(20 * s)), Align = TextAnchor.UpperCenter, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(430 * s)} {Mathf.RoundToInt(-178 * s)}", OffsetMax = $"{Mathf.RoundToInt(441 * s)} {Mathf.RoundToInt(-148 * s)}" }
                    }, UIName);

                    // Panel: Rectangle 64
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.388 0.388 0.388 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(498 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "arrow_rectangle_64_0");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(522 * s)} {Mathf.RoundToInt(-172 * s)}", OffsetMax = $"{Mathf.RoundToInt(531 * s)} {Mathf.RoundToInt(-154 * s)}" } } });
                    // Panel: Rectangle 64
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.388 0.388 0.388 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-290 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(-233 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "arrow_rectangle_64_0");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_1") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-266 * s)} {Mathf.RoundToInt(-171 * s)}", OffsetMax = $"{Mathf.RoundToInt(-257 * s)} {Mathf.RoundToInt(-153 * s)}" } } });
                    // Panel: КУПИТЬ PREMIUM
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-290 * s)} {Mathf.RoundToInt(251 * s)}", OffsetMax = $"{Mathf.RoundToInt(-108 * s)} {Mathf.RoundToInt(300 * s)}" }
                    }, UIName, "panbp_premium_3");

                        // Text: BATTLE PASS
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "BATTLE PASS", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(24 * s)), Align = TextAnchor.UpperLeft, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                            RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-79 * s)} {Mathf.RoundToInt(-17 * s)}", OffsetMax = $"{Mathf.RoundToInt(55 * s)} {Mathf.RoundToInt(19 * s)}" }
                        }, "panbp_premium_3");

                    // Panel: До завершения: 29 дней 15ч
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-103 * s)} {Mathf.RoundToInt(251 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(300 * s)}" }
                    }, UIName, "panbp_29_15_4");

                        elements.Add(new CuiElement { Parent = "panbp_29_15_4", Components = { new CuiRawImageComponent { Png = assets.Get("Vector_2") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-317 * s)} {Mathf.RoundToInt(-10 * s)}", OffsetMax = $"{Mathf.RoundToInt(-296 * s)} {Mathf.RoundToInt(11 * s)}" } } });
                        // Text: ДО ЗАВЕРШЕНИЯ: 29 ДНЕЙ 15Ч
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "ДО ЗАВЕРШЕНИЯ: 29 ДНЕЙ 15Ч", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(22 * s)), Align = TextAnchor.MiddleLeft, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                            RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-286 * s)} {Mathf.RoundToInt(-24 * s)}", OffsetMax = $"{Mathf.RoundToInt(69 * s)} {Mathf.RoundToInt(25 * s)}" }
                        }, "panbp_29_15_4");

                    // Panel: Rectangle 51
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-74 * s)} {Mathf.RoundToInt(35 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(192 * s)}" }
                    }, UIName, "disc_rectangle_51_0");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_3") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(271 * s)} {Mathf.RoundToInt(35 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(192 * s)}" } } });
                    // Panel: Rectangle 52
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-74 * s)} {Mathf.RoundToInt(197 * s)}", OffsetMax = $"{Mathf.RoundToInt(339 * s)} {Mathf.RoundToInt(246 * s)}" }
                    }, UIName, "disc_rectangle_52_1");

                    // Text: ВАШ СТАТУС: PREMIUM
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "ВАШ СТАТУС: PREMIUM", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(24 * s)), Align = TextAnchor.UpperLeft, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-62 * s)} {Mathf.RoundToInt(203 * s)}", OffsetMax = $"{Mathf.RoundToInt(205 * s)} {Mathf.RoundToInt(239 * s)}" }
                    }, UIName);

                    // Text: ЗАЩИТИТЕ СВОЮ БАЗУ НАХОДЯСЬ ОФФЛАЙН. НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ !НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ ! НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ !НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ !
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "ЗАЩИТИТЕ СВОЮ БАЗУ НАХОДЯСЬ ОФФЛАЙН. НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ !НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ ! НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ !НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ НАСТРОЙКА ОПОВЕЩЕНИЯ ДЛЯ ВАШЕЙ КОМАНДЫ !", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(16 * s)), Align = TextAnchor.UpperLeft, Color = "0.776 0.769 0.761 0.780", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-62 * s)} {Mathf.RoundToInt(47 * s)}", OffsetMax = $"{Mathf.RoundToInt(543 * s)} {Mathf.RoundToInt(180 * s)}" }
                    }, UIName);

                    // Panel: ПОДРОБНЕЕ
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(243 * s)} {Mathf.RoundToInt(-19 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(30 * s)}" }
                    }, UIName, "el_0");

                        // Text: ПОДРОБНЕЕ
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "ПОДРОБНЕЕ", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(21 * s)), Align = TextAnchor.UpperCenter, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                            RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-54 * s)} {Mathf.RoundToInt(-15 * s)}", OffsetMax = $"{Mathf.RoundToInt(55 * s)} {Mathf.RoundToInt(16 * s)}" }
                        }, "el_0");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_4") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(271 * s)} {Mathf.RoundToInt(-19 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(30 * s)}" } } });
                    // Panel: Rectangle 19
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.110 0.329 0.475 0.290" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(344 * s)} {Mathf.RoundToInt(197 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(246 * s)}" }
                    }, UIName, "premium_rectangle_19_0");

                    // Text: КУПЛЕН
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "КУПЛЕН", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(21 * s)), Align = TextAnchor.UpperCenter, Color = "0.518 0.733 0.886 0.290", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(414 * s)} {Mathf.RoundToInt(206 * s)}", OffsetMax = $"{Mathf.RoundToInt(487 * s)} {Mathf.RoundToInt(237 * s)}" }
                    }, UIName);

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_5") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(344 * s)} {Mathf.RoundToInt(197 * s)}", OffsetMax = $"{Mathf.RoundToInt(555 * s)} {Mathf.RoundToInt(246 * s)}" } } });
                    // Panel: Rectangle 161124276
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-74 * s)} {Mathf.RoundToInt(-19 * s)}", OffsetMax = $"{Mathf.RoundToInt(238 * s)} {Mathf.RoundToInt(29 * s)}" }
                    }, UIName, "disc_rectangle_161124276_6");

                    // Text: УВЕЛИЧИТЬ УРОВЕНЬ
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "УВЕЛИЧИТЬ УРОВЕНЬ", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(21 * s)), Align = TextAnchor.MiddleCenter, Color = "0.776 0.769 0.761 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-74 * s)} {Mathf.RoundToInt(-19 * s)}", OffsetMax = $"{Mathf.RoundToInt(238 * s)} {Mathf.RoundToInt(29 * s)}" }
                    }, UIName);

                    // Panel: Rectangle 52
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-228 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(-112 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "free_rectangle_52_0");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_6") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-197 * s)} {Mathf.RoundToInt(-104 * s)}", OffsetMax = $"{Mathf.RoundToInt(-144 * s)} {Mathf.RoundToInt(-59 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_7") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-228 * s)} {Mathf.RoundToInt(-54 * s)}", OffsetMax = $"{Mathf.RoundToInt(-197 * s)} {Mathf.RoundToInt(-24 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_8") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-152 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(-112 * s)} {Mathf.RoundToInt(-108 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Rectangle_54") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-107 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(9 * s)} {Mathf.RoundToInt(-24 * s)}" } } });
                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-94 * s)} {Mathf.RoundToInt(-120 * s)}", OffsetMax = $"{Mathf.RoundToInt(-5 * s)} {Mathf.RoundToInt(-44 * s)}" }
                    }, UIName, "group_118_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_118_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 56
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.174" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(14 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(130 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "group_119_rectangle_56_0");

                    // Panel: Rectangle 58
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(135 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(251 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "group_120_rectangle_58_0");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(148 * s)} {Mathf.RoundToInt(-120 * s)}", OffsetMax = $"{Mathf.RoundToInt(237 * s)} {Mathf.RoundToInt(-44 * s)}" }
                    }, UIName, "group_120_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_120_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 60
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.174" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(256 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(372 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "group_121_rectangle_60_0");

                    // Panel: Rectangle 62
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(377 * s)} {Mathf.RoundToInt(-140 * s)}", OffsetMax = $"{Mathf.RoundToInt(493 * s)} {Mathf.RoundToInt(-24 * s)}" }
                    }, UIName, "group_122_rectangle_62_0");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(390 * s)} {Mathf.RoundToInt(-120 * s)}", OffsetMax = $"{Mathf.RoundToInt(479 * s)} {Mathf.RoundToInt(-44 * s)}" }
                    }, UIName, "group_122_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_122_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 52
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.518 0.733 0.886 0.190" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-228 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(-112 * s)} {Mathf.RoundToInt(-185 * s)}" }
                    }, UIName, "premium_rectangle_52_0");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_9") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-197 * s)} {Mathf.RoundToInt(-265 * s)}", OffsetMax = $"{Mathf.RoundToInt(-144 * s)} {Mathf.RoundToInt(-220 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_10") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-228 * s)} {Mathf.RoundToInt(-215 * s)}", OffsetMax = $"{Mathf.RoundToInt(-197 * s)} {Mathf.RoundToInt(-185 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_11") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-152 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(-112 * s)} {Mathf.RoundToInt(-269 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Rectangle_55") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-107 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(9 * s)} {Mathf.RoundToInt(-185 * s)}" } } });
                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-94 * s)} {Mathf.RoundToInt(-281 * s)}", OffsetMax = $"{Mathf.RoundToInt(-5 * s)} {Mathf.RoundToInt(-205 * s)}" }
                    }, UIName, "group_123_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_123_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 57
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(14 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(130 * s)} {Mathf.RoundToInt(-185 * s)}" }
                    }, UIName, "group_124_rectangle_57_0");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(27 * s)} {Mathf.RoundToInt(-281 * s)}", OffsetMax = $"{Mathf.RoundToInt(116 * s)} {Mathf.RoundToInt(-205 * s)}" }
                    }, UIName, "group_124_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_124_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 59
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(135 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(251 * s)} {Mathf.RoundToInt(-185 * s)}" }
                    }, UIName, "group_125_rectangle_59_0");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(148 * s)} {Mathf.RoundToInt(-281 * s)}", OffsetMax = $"{Mathf.RoundToInt(237 * s)} {Mathf.RoundToInt(-205 * s)}" }
                    }, UIName, "group_125_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_125_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 61
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(256 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(372 * s)} {Mathf.RoundToInt(-185 * s)}" }
                    }, UIName, "group_126_rectangle_61_0");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(269 * s)} {Mathf.RoundToInt(-281 * s)}", OffsetMax = $"{Mathf.RoundToInt(358 * s)} {Mathf.RoundToInt(-205 * s)}" }
                    }, UIName, "group_126_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_126_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 63
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(377 * s)} {Mathf.RoundToInt(-301 * s)}", OffsetMax = $"{Mathf.RoundToInt(493 * s)} {Mathf.RoundToInt(-185 * s)}" }
                    }, UIName, "group_127_rectangle_63_0");

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(390 * s)} {Mathf.RoundToInt(-281 * s)}", OffsetMax = $"{Mathf.RoundToInt(479 * s)} {Mathf.RoundToInt(-205 * s)}" }
                    }, UIName, "group_127_image_363_1");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_127_image_363_1",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: Rectangle 50
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.325 0.325 0.325 0.600" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-290 * s)} {Mathf.RoundToInt(30 * s)}", OffsetMax = $"{Mathf.RoundToInt(-79 * s)} {Mathf.RoundToInt(246 * s)}" }
                    }, UIName, "group_128_rectangle_50_0");

                    // Text: 25УР.
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "25УР.", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(18 * s)), Align = TextAnchor.UpperCenter, Color = "0.673 0.673 0.673 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-276 * s)} {Mathf.RoundToInt(181 * s)}", OffsetMax = $"{Mathf.RoundToInt(-236 * s)} {Mathf.RoundToInt(208 * s)}" }
                    }, UIName);

                    // Text: ASSAULT RIFLE
                    elements.Add(new CuiLabel
                    {
                        Text = { Text = "ASSAULT RIFLE", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(20 * s)), Align = TextAnchor.UpperCenter, Color = "0.992 0.992 0.984 1.000", LineSpacing = 1.000f },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-276 * s)} {Mathf.RoundToInt(205 * s)}", OffsetMax = $"{Mathf.RoundToInt(-151 * s)} {Mathf.RoundToInt(236 * s)}" }
                    }, UIName);

                    // Panel: image 363
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0 0 0 0" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-266 * s)} {Mathf.RoundToInt(53 * s)}", OffsetMax = $"{Mathf.RoundToInt(-102 * s)} {Mathf.RoundToInt(192 * s)}" }
                    }, UIName, "group_128_image_363_3");

                    // Image for image 363
                    elements.Add(new CuiElement
                    {
                        Parent = "group_128_image_363_3",
                        Components =
                        {
                            new CuiRawImageComponent { Png = assets.Get("image_363") },
                            new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }
                        }
                    });

                    // Panel: забрать
                    elements.Add(new CuiPanel
                    {
                        Image = { Color = "0.443 0.545 0.267 1.000" },
                        RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-290 * s)} {Mathf.RoundToInt(-19 * s)}", OffsetMax = $"{Mathf.RoundToInt(-79 * s)} {Mathf.RoundToInt(30 * s)}" }
                    }, UIName, "item_1");

                        // Text: ЗАБРАТЬ
                        elements.Add(new CuiLabel
                        {
                            Text = { Text = "ЗАБРАТЬ", FontSize = (int)Mathf.Max(1, Mathf.RoundToInt(21 * s)), Align = TextAnchor.MiddleCenter, Color = "0.745 0.855 0.561 1.000", LineSpacing = 1.000f },
                            RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(-77 * s)} {Mathf.RoundToInt(-24 * s)}", OffsetMax = $"{Mathf.RoundToInt(78 * s)} {Mathf.RoundToInt(25 * s)}" }
                        }, "item_1");

                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_12") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(186 * s)} {Mathf.RoundToInt(-1 * s)}", OffsetMax = $"{Mathf.RoundToInt(202 * s)} {Mathf.RoundToInt(6 * s)}" } } });
                    elements.Add(new CuiElement { Parent = UIName, Components = { new CuiRawImageComponent { Png = assets.Get("Vector_13") }, new CuiRectTransformComponent { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = $"{Mathf.RoundToInt(186 * s)} {Mathf.RoundToInt(7 * s)}", OffsetMax = $"{Mathf.RoundToInt(202 * s)} {Mathf.RoundToInt(14 * s)}" } } });
            CuiHelper.AddUi(player, elements);
        }

        private void CloseUI(BasePlayer player)
        {
            CuiHelper.DestroyUi(player, UIName);
            playersWithUI.Remove(player.userID);
        }

        void OnPlayerDisconnected(BasePlayer player) { playersWithUI.Remove(player.userID); }

        void Unload() { assets?.Cancel(); foreach (var p in BasePlayer.activePlayerList) CloseUI(p); playersWithUI.Clear(); }
        private static readonly string[] _assetKeys = new string[] { "Vector", "Vector_1", "Vector_2", "Vector_3", "Vector_4", "Vector_5", "Vector_6", "Vector_7", "Vector_8", "Rectangle_54", "image_363", "Vector_9", "Vector_10", "Vector_11", "Rectangle_55", "Vector_12", "Vector_13" };
        void OnServerInitialized()
        {
            // Создаем директорию для изображений, если её нет
            var imagesDir = System.IO.Path.Combine(Interface.Oxide.DataDirectory, "PanbpUI", "Images");
            if (!System.IO.Directory.Exists(imagesDir))
            {
                System.IO.Directory.CreateDirectory(imagesDir);
                Puts($"[PanbpUI] Создана директория для изображений: {imagesDir}");
                Puts($"[PanbpUI] Поместите PNG файлы в эту директорию с именами: {string.Join(", ", _assetKeys)}");
            }
            assets = new UIAssetsLoader("PanbpUI", this);
            assets.StartLoad(_assetKeys);
        }
        [ChatCommand("panbpassets")]
        void CmdAssets(BasePlayer player, string command, string[] args)
        {
            if (assets == null) { player.ChatMessage("Assets: loader not initialized"); return; }
            var imagesDir = System.IO.Path.Combine(Interface.Oxide.DataDirectory, "PanbpUI", "Images");
            player.ChatMessage($"Assets: requested={assets.Requested}, loaded={assets.Loaded}, failed={assets.Failed}");
            player.ChatMessage($"Images directory: {imagesDir}");
        }
    }
}
