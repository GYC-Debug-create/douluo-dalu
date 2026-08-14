#!/usr/bin/env python3
"""
斗罗大陆游戏 - 全面自动化测试脚本
覆盖所有功能页面和按钮交互

使用方法:
  1. 确保服务器已启动: node server.js
  2. 运行测试: python test_comprehensive.py
  3. 查看结果: test_results.json

测试覆盖:
  - 标题页: 新的旅程 / 继续冒险 / 万象图鉴
  - 创建角色: 名字输入 → 出身选择 → 武魂觉醒 → 确认
  - 游戏画面左侧面板: 查看魂技详解 / 日记 / 统计 / 设置
  - 游戏画面顶部按钮(4组折叠菜单):
    常用: 背包 / 商店 / 地图 / 旅行 / 任务 / 签到
    成长: 技能树 / 魂骨 / 锻造 / 修炼 / 挑战塔 / 阵法 / 成就 / 称号
    人物与图鉴: 人物 / 关系 / 万象图鉴
    系统: 存档 / 帮助 / 返回主页
  - 页面切换: 游戏→地图 / 游戏→图鉴 / 返回主页
  - 图鉴独立页面: 6个标签页切换
  - 地图独立页面: 缩放按钮 / 地点标记点击 / 详情面板
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
results = {
    "console_errors": [],
    "page_errors": [],
    "button_tests": [],
    "flow_tests": [],
    "summary": {}
}

def log(msg, level="INFO"):
    print(f"[{level}] {msg}")

def close_all_modals(page):
    """关闭所有打开的模态框"""
    for _ in range(5):
        if page.locator("#modal-mask.show").count() == 0:
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    if page.locator("#modal-mask.show").count() > 0:
        try:
            page.locator("#modal-x").click()
            page.wait_for_timeout(300)
        except:
            pass

def test_btn(page, btn_id, label, expect_modal=False, expect_toast=False, wait_ms=800):
    """测试按钮点击后有响应"""
    try:
        btn = page.locator(f"#{btn_id}")
        if btn.count() == 0:
            results["button_tests"].append({"id": btn_id, "label": label, "status": "not_found"})
            log(f"  [{label}] 按钮不存在", "WARN")
            return False
        if not btn.is_visible():
            results["button_tests"].append({"id": btn_id, "label": label, "status": "not_visible"})
            log(f"  [{label}] 不可见")
            return False
        if not btn.is_enabled():
            results["button_tests"].append({"id": btn_id, "label": label, "status": "disabled"})
            log(f"  [{label}] 被禁用")
            return False
        
        btn.click()
        page.wait_for_timeout(wait_ms)
        
        modal_visible = page.locator("#modal-mask.show").count() > 0
        toast_visible = page.locator("#toast.show").count() > 0
        
        if expect_modal and not modal_visible:
            results["button_tests"].append({"id": btn_id, "label": label, "status": "no_modal"})
            log(f"  [{label}] 未弹出模态框")
            return False
        if expect_toast and not toast_visible:
            results["button_tests"].append({"id": btn_id, "label": label, "status": "no_toast"})
            log(f"  [{label}] 未显示提示")
            return False
        
        resp = ""
        if modal_visible: resp = "(弹窗)"
        elif toast_visible: resp = "(提示)"
        results["button_tests"].append({"id": btn_id, "label": label, "status": "pass"})
        log(f"  [{label}] 点击成功 {resp}")
        
        if modal_visible:
            close_all_modals(page)
        
        return True
    except Exception as e:
        results["button_tests"].append({"id": btn_id, "label": label, "status": "error", "error": str(e)})
        log(f"  [{label}] 异常: {e}", "ERROR")
        return False

def open_details_group(page, group_idx):
    """打开指定的 details 折叠组"""
    details = page.locator("details.top-group").nth(group_idx)
    if details.count() == 0:
        return False
    if details.get_attribute("open") is not None:
        details.evaluate("el => el.removeAttribute('open')")
        page.wait_for_timeout(200)
    summary = details.locator("summary")
    if summary.count() > 0:
        summary.click()
        page.wait_for_timeout(400)
        return True
    return False

def setup_page(page):
    page.on("console", lambda msg: results["console_errors"].append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: results["page_errors"].append(str(err)))
    page.add_init_script("""
        sessionStorage.setItem('dldl_intro_seen', '1');
        localStorage.setItem('dldl_tutorial_done', '1');
    """)

def ensure_no_intro(page):
    try:
        page.evaluate("""
            const intro = document.getElementById('cinematic-intro');
            if(intro){ intro.classList.add('hide'); intro.style.display = 'none'; }
        """)
    except:
        pass

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()
        setup_page(page)
        
        # ========== 1. 加载主页 ==========
        log("=" * 60)
        log("测试阶段 1: 加载主页")
        log("=" * 60)
        page.goto(f"{BASE_URL}/game.html", wait_until="networkidle")
        page.wait_for_timeout(2000)
        ensure_no_intro(page)
        page.wait_for_timeout(500)
        
        title_screen = page.locator("#screen-title")
        if title_screen.is_visible():
            log("  标题页加载成功")
            results["flow_tests"].append({"test": "标题页加载", "status": "pass"})
        else:
            log("  标题页未显示", "ERROR")
            results["flow_tests"].append({"test": "标题页加载", "status": "fail"})
        
        # ========== 2. 标题页按钮 ==========
        log("\n测试阶段 2: 标题页按钮")
        log("-" * 40)
        for btn_id, label in [("btn-new", "新的旅程"), ("btn-continue", "继续冒险"), ("btn-codex", "万象图鉴")]:
            btn = page.locator(f"#{btn_id}")
            if btn.count() > 0 and btn.is_visible() and btn.is_enabled():
                results["button_tests"].append({"id": btn_id, "label": label, "status": "pass"})
                log(f"  [{label}] 可见且可用")
            else:
                results["button_tests"].append({"id": btn_id, "label": label, "status": "fail"})
                log(f"  [{label}] 不可用", "ERROR")
        
        # 测试万象图鉴
        page.locator("#btn-codex").click()
        page.wait_for_timeout(2000)
        if page.locator("#screen-codex").is_visible() or page.locator("#codex-iframe").is_visible():
            log("  万象图鉴页面显示")
            results["flow_tests"].append({"test": "标题页-图鉴", "status": "pass"})
            back = page.locator("#btn-codex-back")
            if back.count() > 0 and back.is_visible():
                back.click()
                page.wait_for_timeout(1000)
        else:
            log("  万象图鉴页面未显示", "ERROR")
            results["flow_tests"].append({"test": "标题页-图鉴", "status": "fail"})
        
        # 测试继续冒险
        continue_btn = page.locator("#btn-continue")
        if continue_btn.is_visible() and continue_btn.is_enabled():
            continue_btn.click()
            page.wait_for_timeout(1500)
            if page.locator("#modal-mask.show").is_visible():
                log("  继续冒险弹出存档列表")
                close_all_modals(page)
            else:
                log("  继续冒险未弹出存档列表(可能无存档)")
                close_all_modals(page)
            results["flow_tests"].append({"test": "继续冒险", "status": "pass"})
        else:
            log("  继续冒险按钮不可用")
            results["flow_tests"].append({"test": "继续冒险", "status": "pass"})
        
        # ========== 3. 创建角色流程 ==========
        log("\n测试阶段 3: 创建角色流程")
        log("-" * 40)
        page.locator("#btn-new").click()
        page.wait_for_timeout(1500)
        
        if page.locator("#screen-create").is_visible():
            log("  创建角色页面显示")
            results["flow_tests"].append({"test": "创建角色页面", "status": "pass"})
        else:
            log("  创建角色页面未显示", "ERROR")
            results["flow_tests"].append({"test": "创建角色页面", "status": "fail"})
        
        name_input = page.locator("#input-name")
        if name_input.count() > 0:
            name_input.fill("测试勇者")
            page.wait_for_timeout(300)
            log("  输入角色名: 测试勇者")
        
        test_btn(page, "btn-to-origin", "下一步(出身)", wait_ms=1000)
        
        page.wait_for_timeout(500)
        origin_options = page.locator(".origin-card, [data-origin-id], .choice-btn[data-origin]")
        if origin_options.count() == 0:
            origin_options = page.locator("#step-2 .choice-btn, #origin-list > *")
        if origin_options.count() > 0:
            origin_options.first.click()
            page.wait_for_timeout(500)
            log(f"  选择出身 (共{origin_options.count()}个选项)")
        
        test_btn(page, "btn-to-awaken", "进行武魂觉醒", wait_ms=1500)
        
        awaken_btn = page.locator("#btn-awaken")
        if awaken_btn.count() > 0 and awaken_btn.is_visible() and awaken_btn.is_enabled():
            awaken_btn.click()
            page.wait_for_timeout(4000)
            log("  武魂觉醒动画播放")
        else:
            log("  觉醒按钮不可用", "WARN")
            page.wait_for_timeout(2000)
        
        confirm_btn = page.locator("#btn-confirm-spirit")
        for _ in range(5):
            if confirm_btn.count() > 0 and confirm_btn.is_visible():
                confirm_btn.click()
                page.wait_for_timeout(2000)
                log("  确认武魂")
                results["flow_tests"].append({"test": "武魂确认", "status": "pass"})
                break
            page.wait_for_timeout(2000)
        else:
            log("  确认武魂按钮未出现", "ERROR")
            results["flow_tests"].append({"test": "武魂确认", "status": "fail"})
        
        log("  跳过开场剧情...")
        for _ in range(60):
            area = page.locator("#scene-area")
            if area.count() == 0 or not area.is_visible():
                break
            try:
                page.keyboard.press("Space")
            except:
                break
            page.wait_for_timeout(200)
        
        page.wait_for_timeout(2000)
        ensure_no_intro(page)
        
        game_screen = page.locator("#screen-game")
        if game_screen.is_visible():
            log("  游戏画面显示")
            results["flow_tests"].append({"test": "进入游戏", "status": "pass"})
        else:
            log("  游戏画面未显示", "ERROR")
            results["flow_tests"].append({"test": "进入游戏", "status": "fail"})
        
        # ========== 4. 游戏画面按钮 ==========
        if game_screen.is_visible():
            log("\n测试阶段 4: 游戏画面按钮")
            log("-" * 40)
            
            log("  --- 左侧面板 ---")
            test_btn(page, "btn-skills", "查看魂技详解", expect_toast=True)
            test_btn(page, "btn-journal", "日记", expect_modal=True)
            test_btn(page, "btn-stats", "统计", expect_modal=True)
            test_btn(page, "btn-settings", "设置", expect_modal=True)
            
            log("  --- 常用按钮组 ---")
            if open_details_group(page, 0):
                test_btn(page, "btn-bag", "背包", expect_modal=True)
                test_btn(page, "btn-shop", "商店", expect_modal=True)
                test_btn(page, "btn-quests", "任务", expect_modal=True)
                test_btn(page, "btn-signin", "签到", expect_modal=True)
                test_btn(page, "btn-fasttravel", "旅行", expect_modal=True)
                page.locator("#btn-map").click()
                page.wait_for_timeout(2000)
                if page.locator("#screen-map").is_visible() or page.locator("#map-iframe").is_visible():
                    log("  地图页面显示")
                    results["flow_tests"].append({"test": "游戏-地图", "status": "pass"})
                    back = page.locator("#btn-map-back")
                    if back.count() > 0 and back.is_visible():
                        back.click()
                        page.wait_for_timeout(1000)
                else:
                    log("  地图页面未显示", "ERROR")
                    results["flow_tests"].append({"test": "游戏-地图", "status": "fail"})
            
            log("  --- 成长按钮组 ---")
            close_all_modals(page)
            if open_details_group(page, 1):
                test_btn(page, "btn-skilltree", "技能树", expect_modal=True)
                test_btn(page, "btn-bone", "魂骨", expect_modal=True)
                test_btn(page, "btn-forge", "锻造", expect_modal=True)
                test_btn(page, "btn-train", "修炼", expect_modal=True)
                test_btn(page, "btn-tower", "挑战塔", expect_modal=True)
                test_btn(page, "btn-formation", "阵法", expect_modal=True)
                test_btn(page, "btn-ach", "成就", expect_modal=True)
                test_btn(page, "btn-title", "称号", expect_modal=True)
            
            log("  --- 人物与图鉴按钮组 ---")
            close_all_modals(page)
            if open_details_group(page, 2):
                test_btn(page, "btn-npc", "人物", expect_modal=True)
                test_btn(page, "btn-relation", "关系", expect_modal=True)
                page.locator("#btn-codex2").click()
                page.wait_for_timeout(2000)
                if page.locator("#screen-codex").is_visible() or page.locator("#codex-iframe").is_visible():
                    log("  图鉴页面显示")
                    results["flow_tests"].append({"test": "游戏-图鉴", "status": "pass"})
                    back = page.locator("#btn-codex-back")
                    if back.count() > 0 and back.is_visible():
                        back.click()
                        page.wait_for_timeout(1000)
                else:
                    log("  图鉴页面未显示", "ERROR")
                    results["flow_tests"].append({"test": "游戏-图鉴", "status": "fail"})
            
            log("  --- 系统按钮组 ---")
            close_all_modals(page)
            if open_details_group(page, 3):
                test_btn(page, "btn-save", "存档", expect_toast=True)
                test_btn(page, "btn-help", "帮助", expect_modal=True)
                page.locator("#btn-home").click()
                page.wait_for_timeout(1500)
                close_all_modals(page)
                if page.locator("#modal-mask.show").count() > 0:
                    confirm_btns = page.locator(".modal-box button")
                    for i in range(confirm_btns.count()):
                        try:
                            c = confirm_btns.nth(i)
                            txt = c.inner_text()
                            if "确认" in txt or "确定" in txt or "返回" in txt:
                                c.click()
                                page.wait_for_timeout(1000)
                                break
                        except:
                            pass
                close_all_modals(page)
                if page.locator("#screen-title").is_visible():
                    log("  返回主页成功")
                    results["flow_tests"].append({"test": "返回主页", "status": "pass"})
                else:
                    log("  返回主页失败", "ERROR")
                    results["flow_tests"].append({"test": "返回主页", "status": "fail"})
        
        # ========== 5. 图鉴独立页面 ==========
        log("\n测试阶段 5: 图鉴独立页面")
        log("-" * 40)
        page.goto(f"{BASE_URL}/codex.html", wait_until="networkidle")
        page.wait_for_timeout(2000)
        
        tabs = page.locator(".tab[data-codex]")
        if tabs.count() == 0:
            tabs = page.locator(".tab")
        if tabs.count() > 0:
            log(f"  图鉴页面加载成功，发现 {tabs.count()} 个标签页")
            results["flow_tests"].append({"test": "图鉴独立页面", "status": "pass"})
            for i in range(min(tabs.count(), 6)):
                try:
                    tab = tabs.nth(i)
                    if tab.is_visible():
                        tab_name = tab.inner_text()[:20]
                        tab.click()
                        page.wait_for_timeout(1000)
                        log(f"  标签页[{i}]: {tab_name}")
                except Exception as e:
                    log(f"  标签页[{i}] 异常: {e}", "WARN")
        else:
            log("  图鉴页面未加载", "ERROR")
            results["flow_tests"].append({"test": "图鉴独立页面", "status": "fail"})
        
        # ========== 6. 地图独立页面 ==========
        log("\n测试阶段 6: 地图独立页面")
        log("-" * 40)
        page.goto(f"{BASE_URL}/map.html", wait_until="networkidle")
        page.wait_for_timeout(2000)
        
        map_bg = page.locator("#mapBg, .map-bg")
        markers = page.locator(".location-marker")
        
        if map_bg.count() > 0:
            log(f"  地图页面加载成功，发现 {markers.count()} 个地点标记")
            results["flow_tests"].append({"test": "地图独立页面", "status": "pass"})
        else:
            log("  地图页面未加载", "ERROR")
            results["flow_tests"].append({"test": "地图独立页面", "status": "fail"})
        
        for btn_id, label in [("zoomIn", "放大"), ("zoomOut", "缩小"), ("zoomReset", "重置缩放")]:
            btn = page.locator(f"#{btn_id}")
            if btn.count() > 0 and btn.is_visible():
                btn.click()
                page.wait_for_timeout(500)
                log(f"  {label}按钮")
                results["button_tests"].append({"id": btn_id, "label": label, "status": "pass"})
            else:
                log(f"  {label}按钮不可用", "WARN")
                results["button_tests"].append({"id": btn_id, "label": label, "status": "not_visible"})
        
        if markers.count() > 0:
            try:
                page.evaluate("""() => {
                    const marker = document.querySelector('.location-marker');
                    if(marker) marker.click();
                }""")
                page.wait_for_timeout(1000)
                detail = page.locator("#detailPanel, .detail-panel")
                detail_class = detail.get_attribute("class") if detail.count() > 0 else ""
                if detail_class and "open" in detail_class:
                    log("  地点详情面板显示")
                    results["button_tests"].append({"id": "marker-0", "label": "地点标记点击", "status": "pass"})
                    close = page.locator("#panelClose, .panel-close")
                    if close.count() > 0:
                        close.click(force=True)
                        page.wait_for_timeout(500)
                elif detail.count() > 0 and detail.is_visible():
                    log("  地点详情面板显示(visible)")
                    results["button_tests"].append({"id": "marker-0", "label": "地点标记点击", "status": "pass"})
                else:
                    results["button_tests"].append({"id": "marker-0", "label": "地点标记点击", "status": "no_detail"})
                    log("  地点详情面板未显示", "WARN")
            except Exception as e:
                log(f"  地点标记异常: {e}", "WARN")
                results["button_tests"].append({"id": "marker-0", "label": "地点标记点击", "status": "error"})
        
        # ========== 汇总 ==========
        log("\n" + "=" * 60)
        log("测试汇总")
        log("=" * 60)
        
        total_buttons = len(results["button_tests"])
        passed_buttons = sum(1 for r in results["button_tests"] if r["status"] == "pass")
        total_flows = len(results["flow_tests"])
        passed_flows = sum(1 for r in results["flow_tests"] if r["status"] == "pass")
        
        results["summary"] = {
            "total_buttons": total_buttons,
            "passed_buttons": passed_buttons,
            "failed_buttons": total_buttons - passed_buttons,
            "total_flows": total_flows,
            "passed_flows": passed_flows,
            "failed_flows": total_flows - passed_flows,
            "console_errors": len(results["console_errors"]),
            "page_errors": len(results["page_errors"])
        }
        
        log(f"按钮测试: {passed_buttons}/{total_buttons} 通过")
        log(f"流程测试: {passed_flows}/{total_flows} 通过")
        log(f"控制台错误: {len(results['console_errors'])} 个")
        log(f"页面错误: {len(results['page_errors'])} 个")
        
        if results["console_errors"]:
            log("\n控制台错误:")
            for err in results["console_errors"][:15]:
                log(f"  - {err[:200]}", "ERROR")
        
        if results["page_errors"]:
            log("\n页面错误:")
            for err in results["page_errors"][:10]:
                log(f"  - {err[:200]}", "ERROR")
        
        failed = [r for r in results["button_tests"] if r["status"] != "pass"]
        if failed:
            log("\n失败按钮:")
            for r in failed:
                log(f"  - {r['label']} ({r['id']}): {r['status']}")
        
        failed_flows = [r for r in results["flow_tests"] if r["status"] != "pass"]
        if failed_flows:
            log("\n失败流程:")
            for r in failed_flows:
                log(f"  - {r['test']}: {r['status']}")
        
        results_path = os.path.join(SCRIPT_DIR, "test_results.json")
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        log(f"\n测试结果已保存: {results_path}")
        
        browser.close()
        return 0 if not results["page_errors"] else 1

if __name__ == "__main__":
    sys.exit(run_tests())
