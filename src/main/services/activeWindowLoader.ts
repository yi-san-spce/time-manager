/**
 * get-windows 是纯 ESM 包（"type": "module"，无 CJS 导出），而 electron-vite 把 main
 * 进程打包成 CJS。用动态 import() 加载，Node 的 CJS 运行时原生支持这种方式加载 ESM 模块。
 */
export async function loadActiveWindow(): Promise<
  () => Promise<{ title: string; owner: { name: string } } | undefined>
> {
  const mod = await import('get-windows')
  return mod.activeWindow as () => Promise<{ title: string; owner: { name: string } } | undefined>
}
