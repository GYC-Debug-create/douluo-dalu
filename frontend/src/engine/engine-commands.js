/**
 * 引擎命令注册表:解决事件子系统之间的循环调用(flow ↔ exploration/growth)。
 *
 * 组合根(useEventEngine)先创建注册表并注入各子系统;子系统通过
 * commands.nextEvent(...) 请求"另一个子系统"的动作,组合根在装配完成后
 * 统一 register 实现。依赖方向因此恒为"子系统 → 命令槽",不再需要
 * late 钩子或相互持有对方实例。
 *
 * 约定:
 *  - 命令槽是显式具名的(不是动态 Proxy),新增命令就在返回对象里加一行;
 *  - 未注册就调用 = 组合根装配顺序错误,直接抛错(fail loud),
 *    不允许静默吞掉。
 */
export function createEngineCommands() {
  const handlers = new Map()

  function register(name, fn) {
    handlers.set(name, fn)
  }

  function makeSlot(name) {
    return (...args) => {
      const fn = handlers.get(name)
      if (!fn) throw new Error(`[engine-commands] 命令 "${name}" 在注册前被调用(组合根装配顺序错误)`)
      return fn(...args)
    }
  }

  return {
    register,
    /** 进入下一个事件(实现方:useEventFlow.nextEvent) */
    nextEvent: makeSlot('nextEvent'),
    /** 记录事件图鉴发现(实现方:useEventFlow.recordEventDiscoveries) */
    recordEventDiscoveries: makeSlot('recordEventDiscoveries')
  }
}
