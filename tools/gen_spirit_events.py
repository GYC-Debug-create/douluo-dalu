import json
import random
random.seed(42)

with open(r'd:\GYC\project\斗罗大陆\public\data\spirit-codex.json','r',encoding='utf-8') as f:
    codex = json.load(f)

events_by_spirit = {}

for spirit in codex['spirits']:
    sid = spirit['id']
    name = spirit['name']
    tier = spirit['tier']
    stype = spirit['type']
    subtype = spirit.get('subtype', '')
    
    evts = []
    
    # Event 1
    e1 = {
        "id": f"spirit_{sid}_resonance",
        "title": f"武魂共鸣·{name}",
        "tags": ["spirit", sid, "resonance"],
        "minLevel": 5,
        "text": f"你感到体内的{name}武魂突然剧烈震颤，一股前所未有的共鸣感涌上心头。"
    }
    
    if stype == '器武魂':
        if '武器' in subtype or '攻击' in subtype:
            e1["text"] += f" {name}散发出凌厉的杀意，仿佛在呼唤你前往战场证明自己的实力。"
            e1["choices"] = [
                {"text": "顺应武魂的呼唤，前往猎魂森林历练", "result": {"text": f"你来到猎魂森林，{name}武魂在你手中发出嗡鸣。一头百年魂兽挡在你面前——你毫不畏惧，{name}挥出，一击毙敌！武魂的共鸣让你的力量大幅提升！", "attack": 3, "exp": 120, "fate": 1}},
                {"text": "静心冥想，尝试与武魂深度沟通", "result": {"text": f"你盘膝而坐，将意识沉入{name}武魂之中。在冥想中你看到了{name}的前世——一位战场上所向披靡的强者。你从他的战斗记忆中领悟了新的技巧！", "exp": 80, "spiritPowerGain": 8, "fate": 2}},
                {"text": "暂时压制武魂的躁动", "result": {"text": f"你强行压制了{name}的躁动。虽然错过了一次机缘，但你学会了更好地控制武魂，精神力得到了锻炼。", "defense": 1, "spiritPowerGain": 3}}
            ]
        elif '辅助' in subtype:
            e1["text"] += f" {name}散发出柔和的光芒，似乎在指引你前往需要帮助的地方。"
            e1["choices"] = [
                {"text": "跟随武魂的指引，前往最近的村庄", "result": {"text": f"你来到一个遭受魂兽袭击的村庄。{name}武魂绽放光芒，你治好了受伤的村民，受到了村民们的感激。", "fate": 2, "exp": 80, "gold": 50}},
                {"text": "在武魂的引导下修炼辅助魂技", "result": {"text": f"你静心感受{name}武魂的辅助之力，成功领悟了更深层的辅助技巧。{name}的光芒比之前更加明亮！", "exp": 100, "spiritPowerGain": 10}},
                {"text": "保持现状，继续赶路", "result": {"text": f"你决定不被打扰，继续自己的旅程。{name}武魂的光芒渐渐平息，但你知道它会在需要的时候再次指引你。", "exp": 30}}
            ]
        elif '防御' in subtype:
            e1["text"] += f" {name}散发出厚重的气息，仿佛在提醒你危险即将来临。"
            e1["choices"] = [
                {"text": "提高警惕，准备应战", "result": {"text": f"你立刻进入戒备状态。果然，一只魂兽从暗处扑来！{name}武魂在关键时刻自动触发防御，为你挡住了致命一击。", "defense": 3, "exp": 100, "hp": 20}},
                {"text": "寻找安全的地方藏身", "result": {"text": f"你找到一个山洞藏身，在里面发现了一处上古防御阵法的遗迹。{name}武魂与阵法产生了共鸣！", "defense": 2, "exp": 120, "fate": 1}},
                {"text": "无视警告，继续前进", "result": {"text": f"你无视了武魂的警告继续前进，结果遭遇了魂兽伏击。虽然受了些伤，但{name}武魂在危急时刻的保护让你明白了警惕的重要性。", "hp": -15, "exp": 50, "defense": 1}}
            ]
        elif '控制' in subtype:
            e1["text"] += f" {name}散发出奇异的波动，周围的空间似乎都变得粘稠起来。"
            e1["choices"] = [
                {"text": "探索武魂的控制之力", "result": {"text": f"你静心感受{name}的控制之力，尝试用武魂束缚周围的物体。你的控制技巧得到了质的飞跃！", "exp": 100, "spiritPowerGain": 8}},
                {"text": "利用武魂的波动寻找附近灵物", "result": {"text": f"你顺着{name}的波动探查四周，发现了一株隐藏在岩石后的灵草。原来武魂的波动可以探测周围环境！", "exp": 80, "gold": 50}},
                {"text": "尝试将控制之力融入战斗", "result": {"text": f"你尝试在战斗中运用{name}的控制之力，成功束缚了一头低级魂兽，轻松将其击败。", "attack": 2, "exp": 80}}
            ]
        else:
            e1["text"] += f" {name}散发出神秘的光芒，仿佛在诉说着什么。"
            e1["choices"] = [
                {"text": "倾听武魂的低语", "result": {"text": f"你静心倾听，{name}似乎在告诉你一个古老的秘密——关于器武魂修炼的独特法门。你按照这个法门修炼，进步神速！", "exp": 120, "fate": 2}},
                {"text": "用魂力滋养武魂", "result": {"text": f"你将魂力注入{name}中，武魂的光芒变得更加明亮。你感到武魂的潜力被进一步激发了！", "spiritPowerGain": 10, "exp": 80}},
                {"text": "暂时不去理会", "result": {"text": f"你决定暂时不去理会武魂的共鸣。虽然有些可惜，但你知道修炼之路不能急于一时。", "exp": 30}}
            ]
    else:
        if '强攻' in subtype:
            e1["text"] += f" {name}武魂在你体内咆哮，野兽的本能渴望释放！"
            e1["choices"] = [
                {"text": "释放武魂之力，寻找猎物", "result": {"text": f"你释放{name}武魂，化为一道残影冲入森林。一头百年魂兽被你追上，{name}的利爪将其撕碎！", "attack": 3, "exp": 120}},
                {"text": "压制兽性，保持理智修炼", "result": {"text": f"你以强大的意志力压制了{name}的兽性，将这股力量转化为修炼的动力。你的精神力得到了锻炼。", "exp": 100, "spiritPowerGain": 8, "fate": 1}},
                {"text": "让武魂自由活动，观察它的行为", "result": {"text": f"你让{name}武魂自由活动，它带领你找到了一处魂兽的巢穴，里面有一些珍贵的魂兽材料。", "gold": 80, "exp": 60}}
            ]
        elif '敏攻' in subtype:
            e1["text"] += f" {name}武魂让你感到浑身轻盈，仿佛可以随风飞翔。"
            e1["choices"] = [
                {"text": "测试武魂带来的速度提升", "result": {"text": f"你全力奔跑，{name}武魂赋予你惊人的速度。你在森林中穿梭自如，甚至能在水面上奔跑！", "speed": 3, "exp": 100}},
                {"text": "利用速度优势探索危险区域", "result": {"text": f"你凭借{name}武魂的速度深入一片危险区域，在一处隐秘的洞穴中发现了一枚上古魂骨碎片！", "exp": 150, "fate": 3}},
                {"text": "练习武魂的敏捷身法", "result": {"text": f"你练习{name}武魂的敏捷身法，在树林间跳跃腾挪。你的身法变得更加灵活。", "speed": 2, "defense": 1, "exp": 80}}
            ]
        elif '防御' in subtype:
            e1["text"] += f" {name}武魂在你体内凝聚，让你感到前所未有的安全感。"
            e1["choices"] = [
                {"text": "测试武魂的防御极限", "result": {"text": f"你找到一处瀑布，让水流冲击自己。{name}武魂自动形成护甲，你在瀑布下岿然不动！", "defense": 3, "exp": 100}},
                {"text": "用武魂保护受伤的旅人", "result": {"text": f"你遇到一位受伤的旅人，{name}武魂展开护盾保护了他。旅人感激不已，告诉你一个宝藏的位置。", "fate": 2, "gold": 100, "exp": 80}},
                {"text": "将防御之力融入日常修炼", "result": {"text": f"你每天修炼时都让{name}武魂释放防御之力，你的身体变得更加坚韧。", "defense": 2, "hp": 30, "exp": 60}}
            ]
        else:
            e1["text"] += f" {name}武魂在你体内苏醒，一股原始的力量在涌动。"
            e1["choices"] = [
                {"text": "顺应武魂的本能，深入森林", "result": {"text": f"你释放{name}武魂走入森林深处。森林中的魂兽感受到你的气息纷纷避让。你在一棵古树下发现了一株千年灵芝！", "exp": 120, "item": {"name": "千年灵芝", "desc": "极品灵药", "effect": {"hp": 30, "attack": 2}}}},
                {"text": "与武魂进行精神交流", "result": {"text": "你盘膝而坐，尝试与{name}武魂进行精神交流。在意识深处，你看到了这个武魂历代主人的战斗画面，从中领悟了新的战斗技巧。", "exp": 100, "fate": 2}},
                {"text": "让武魂自由活动", "result": {"text": f"你让{name}武魂自由活动，它带领你找到了一处温泉，泉水富含灵气，泡一泡对修炼大有裨益。", "exp": 80, "hp": 20}}
            ]
    
    evts.append(e1)
    
    # Event 2: 武魂传承事件 (top/god only)
    if tier in ['top', 'god']:
        e2 = {
            "id": f"spirit_{sid}_legacy",
            "title": f"传承之秘·{name}",
            "tags": ["spirit", sid, "legacy"],
            "minLevel": 20,
            "text": f"你在一处古老遗迹中发现了与{name}武魂相关的记载。原来{name}武魂曾经属于一位传奇人物，遗迹中留下了他的传承考验。"
        }
        if tier == 'god':
            e2["choices"] = [
                {"text": "接受传承考验", "result": {"text": f"你踏入传承法阵，一股浩瀚的神力涌入体内。考验中你看到了{name}武魂历代主人的影像，他们每一位都是神界的传奇。你通过了考验！", "attack": 5, "defense": 5, "hp": 100, "fate": 5, "exp": 500}},
                {"text": "谨慎研究传承内容", "result": {"text": f"你仔细研究遗迹中的壁画和文字，发现了一套失传的修炼功法。这套功法与{name}武魂完美契合！", "exp": 300, "spiritPowerGain": 20, "fate": 3}},
                {"text": "将传承信息记录下来", "result": {"text": "你将遗迹中的信息详细记录下来，准备日后慢慢研究。这些知识价值连城。", "gold": 200, "exp": 150, "fate": 2}}
            ]
        else:
            e2["choices"] = [
                {"text": "接受传承考验", "result": {"text": f"你接受了传承考验。考验中你需要击败{name}武魂历代主人的幻影。经过一番苦战，你成功了！", "attack": 3, "defense": 2, "exp": 250, "fate": 3}},
                {"text": "学习传承中的战斗技巧", "result": {"text": f"你从传承中学习了{name}武魂的独特战斗技巧，这些技巧在当世已经失传。", "attack": 2, "speed": 2, "exp": 200}},
                {"text": "将传承留给后人", "result": {"text": "你将传承内容详细记录下来，准备留给后人。这种无私的行为让你的命运值大幅提升。", "fate": 5, "exp": 100}}
            ]
        evts.append(e2)
    
    # Event 3: 武魂专属机遇事件
    e3 = {
        "id": f"spirit_{sid}_opportunity",
        "title": f"奇遇·{name}之缘",
        "tags": ["spirit", sid, "opportunity"],
        "minLevel": 10,
        "text": f"你在旅途中遇到了一位老者，老者看到你的{name}武魂后，眼中闪过一丝惊讶。"
    }
    
    if tier in ['low', 'mid']:
        e3["text"] += f" '好一个{name}武魂！'老者赞叹道，'老夫年轻时也曾见过一位{name}武魂的魂师，他虽然没有惊天动地的战力，却凭借这个武魂闯出了一番天地。'"
        e3["choices"] = [
            {"text": "请教老者关于武魂的修炼经验", "result": {"text": f"老者耐心地分享了他对{name}武魂的理解。你恍然大悟，对武魂的掌握更进一步。", "exp": 120, "spiritPowerGain": 10, "fate": 2}},
            {"text": "询问那位{name}武魂魂师的故事", "result": {"text": f"老者讲述了一个感人至深的故事。那位{name}武魂的魂师凭借智慧和毅力，完成了一个连封号斗罗都无法完成的任务。", "fate": 3, "exp": 100}},
            {"text": "感谢老者，继续赶路", "result": {"text": "你谢过老者继续赶路。老者在你身后喊道：'年轻人，{name}武魂的潜力远不止于此，不要放弃！'", "exp": 50, "fate": 1}}
        ]
    elif tier == 'high':
        e3["text"] += f" '{name}武魂！'老者激动地说，'这个武魂在百年前曾大放异彩。老夫这里有一件东西，或许对你有用。'"
        e3["choices"] = [
            {"text": "接受老者的馈赠", "result": {"text": f"老者从怀中取出一枚古朴的令牌。'这是当年那位{name}魂师留下的信物，持此令牌可以去天斗城找到他的后人。'", "gold": 100, "fate": 3, "exp": 150}},
            {"text": "婉拒馈赠，但请教修炼经验", "result": {"text": "你婉拒了老者的馈赠，但虚心请教了修炼经验。老者被你的谦逊打动，传授了你一套独特的冥想方法。", "exp": 180, "spiritPowerGain": 15}},
            {"text": "邀请老者同行", "result": {"text": "你邀请老者同行一段路。老者分享了许多关于{name}武魂的修炼心得，这些经验在外界是花多少钱都买不到的。", "exp": 200, "fate": 2}}
        ]
    else:
        e3["text"] += f" '{name}武魂！'老者神色凝重，'这个武魂在历史上出现过几次，每一次都伴随着大陆格局的剧变。年轻人，你肩负着重要的使命。'"
        e3["choices"] = [
            {"text": "询问武魂的使命", "result": {"text": f"老者告诉你，{name}武魂的拥有者曾在远古时代拯救过大陆。你感受到了肩上的重任，武魂的力量也因此觉醒了一部分。", "attack": 3, "defense": 3, "fate": 4, "exp": 300}},
            {"text": "表示自己会承担使命", "result": {"text": f"你坚定地表示自己会承担这份使命。老者欣慰地笑了，将一个护身符送给你。", "fate": 5, "exp": 200}},
            {"text": "谦虚地表示自己还太弱小", "result": {"text": "你谦虚地表示自己还太弱小。老者笑道：'每一个强者都是从弱小开始的。{name}武魂选择了你，就说明你有这个潜力。'", "exp": 150, "spiritPowerGain": 12, "fate": 2}}
        ]
    
    evts.append(e3)
    
    events_by_spirit[sid] = evts

output = {"meta": {"title": "武魂专属事件", "description": "每个武魂独特的个性化事件"}, "spirit_events": events_by_spirit}
with open(r'd:\GYC\project\斗罗大陆\public\data\spirit-events.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Done! Generated events for {len(events_by_spirit)} spirits")
total_events = sum(len(evts) for evts in events_by_spirit.values())
print(f"Total events: {total_events}")