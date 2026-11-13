/**
 * 宿主文件系统上的「Web 选择树」通用能力。
 *
 * 桌面端走 native 面板 / 宿主原生对话框即可；但在纯浏览器或远程访问时，
 * 那些都弹不出来（原生框开在服务器上，远程用户碰不到）。此时改用一棵
 * 渲染在页面里的 DOM 树，数据全部来自宿主暴露的 `tools_webview_browse_dialog`
 * / `list_dir` / `read_file`，选出来的路径是**宿主侧**路径（不是用户本机）。
 *
 * 这套能力放进 SDK，所有插件都能直接用 `pickFromHostTree`；同时模块加载时把
 * 它挂到 `window.__otoolsHostTree`，让宿主 `dialog.open` 的回落链也能自动复用，
 * 做到「桌面 / web 无缝兼容」。
 *
 * 浏览器安全限制：纯 web 永远拿不到用户本机路径，所以这里选的只能是宿主
 * 文件系统上的路径——虚拟机磁盘 / ISO 本就躺在宿主上，语义正好对得上。
 */

import { invoke } from './runtime';
import type {
  OToolsHostDirEntry,
  OToolsHostReadFilePayload,
  OToolsHostBrowsePayload,
} from './otools-globals';

export type HostDirEntry = OToolsHostDirEntry;
export type HostReadFilePayload = OToolsHostReadFilePayload;
export type HostBrowsePayload = OToolsHostBrowsePayload;

export interface PickFromHostTreeOptions {
  title?: string;
  /** true=选目录，false=选文件。 */
  directory?: boolean;
  /** 多文件选择；目录选择返回当前目录。 */
  multiple?: boolean;
  /** 初始目录；缺省由宿主返回 home。 */
  startPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export type HostPickSource = 'host-tree';

export interface HostPickResult {
  kind: 'picked' | 'cancelled';
  source: HostPickSource;
  paths: string[];
  names: string[];
}

/** 列宿主某目录（含根列表与父路径），对应 `tools_webview_browse_dialog`。 */
export async function browseHostDir(path?: string): Promise<HostBrowsePayload> {
  return invoke<HostBrowsePayload>('tools_webview_browse_dialog', { request: { path: path ?? '' } });
}

/** 列宿主目录下的一层条目（对应 `tools_webview_list_dir`）。 */
export async function listHostDir(path: string): Promise<HostDirEntry[]> {
  const target = String(path ?? '').trim();
  if (!target) {
    throw new Error('listHostDir requires path');
  }
  return invoke<HostDirEntry[]>('tools_webview_list_dir', { path: target });
}

/** 读宿主文件内容（对应 `tools_webview_read_file`）。 */
export async function readHostFile(path: string): Promise<HostReadFilePayload> {
  const target = String(path ?? '').trim();
  if (!target) {
    throw new Error('readHostFile requires path');
  }
  return invoke<HostReadFilePayload>('tools_webview_read_file', { path: target });
}

const matchesFilter = (
  entry: HostDirEntry,
  filters?: PickFromHostTreeOptions['filters'],
): boolean => {
  if (!filters?.length) {
    return true;
  }
  if (entry.kind === 'directory') {
    return true;
  }
  const ext = entry.name.includes('.')
    ? entry.name.split('.').pop()!.toLowerCase()
    : '';
  return filters.some(
    (filter) =>
      filter.extensions.some((raw) => raw.trim().toLowerCase().replace(/^\./, '') === ext),
  );
};

function injectHostTreeStyle(): void {
  if (document.getElementById('otools-host-tree-style')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'otools-host-tree-style';
  style.textContent = HOST_TREE_CSS;
  document.head.appendChild(style);
}

/**
 * 弹出一棵宿主文件系统 DOM 树，用户导航后选中目录 / 文件并返回宿主侧路径。
 *
 * 不依赖任何 UI 框架（原生 DOM），所以 Vue / React / 纯 web 都能用。返回结果
 * 带 `source: 'host-tree'`，调用方据此区分「宿主侧路径」与「用户本机路径」。
 */
export async function pickFromHostTree(
  options: PickFromHostTreeOptions,
): Promise<HostPickResult> {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('pickFromHostTree requires a DOM document');
  }

  const directory = Boolean(options.directory);
  const multiple = Boolean(options.multiple) && !directory;
  const title = options.title ?? (directory ? '选择目录' : '选择文件');

  return new Promise<HostPickResult>((resolve) => {
    let currentPath = '';
    let requestedPath = options.startPath ?? '';
    let ready = false;
    let closed = false;
    let requestId = 0;
    const selected = new Set<string>();

    injectHostTreeStyle();

    const overlay = document.createElement('div');
    overlay.setAttribute('data-host-tree', '');
    overlay.className = 'otools-host-tree-overlay';

    const panel = document.createElement('div');
    panel.className = 'otools-host-tree-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);
    overlay.appendChild(panel);

    const header = document.createElement('div');
    header.className = 'otools-host-tree-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'otools-host-tree-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);
    const pathEl = document.createElement('div');
    pathEl.className = 'otools-host-tree-path';
    header.appendChild(pathEl);
    panel.appendChild(header);

    const statusEl = document.createElement('div');
    statusEl.className = 'otools-host-tree-status';
    statusEl.setAttribute('role', 'status');
    statusEl.hidden = true;
    const statusText = document.createElement('span');
    statusText.setAttribute('data-host-tree-error', '');
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'otools-host-tree-btn';
    retryBtn.textContent = '重试';
    retryBtn.setAttribute('data-host-tree-retry', '');
    statusEl.appendChild(statusText);
    statusEl.appendChild(retryBtn);
    panel.appendChild(statusEl);

    const body = document.createElement('div');
    body.className = 'otools-host-tree-body';
    panel.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'otools-host-tree-footer';
    const selectionEl = document.createElement('div');
    selectionEl.className = 'otools-host-tree-selection';
    selectionEl.setAttribute('data-host-tree-selection', '');
    selectionEl.setAttribute('role', 'status');
    selectionEl.textContent = directory ? '请选择目录' : '请选择文件';
    footer.appendChild(selectionEl);
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'otools-host-tree-btn';
    cancelBtn.setAttribute('data-host-tree-cancel', '');
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = directory ? '选择此目录' : '选择';
    confirmBtn.className = 'otools-host-tree-btn otools-host-tree-btn-primary';
    confirmBtn.setAttribute('data-host-tree-confirm', '');
    confirmBtn.disabled = true;
    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);
    panel.appendChild(footer);

    const updateConfirm = () => {
      confirmBtn.disabled = !ready || (directory ? !currentPath : !selected.size);
      pathEl.classList.toggle('otools-host-tree-current', directory && ready && Boolean(currentPath));
      selectionEl.textContent = directory && ready
        ? `已选目录：${currentPath}`
        : selected.size ? `已选 ${selected.size} 个文件` : directory ? '请选择目录' : '请选择文件';
      selectionEl.title = directory && ready ? currentPath : '';
    };

    const close = (result: HostPickResult) => {
      if (closed) return;
      closed = true;
      requestId += 1;
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close({ kind: 'cancelled', source: 'host-tree', paths: [], names: [] });
      }
    };
    window.addEventListener('keydown', onKey, true);

    overlay.addEventListener('mousedown', (event) => {
      if (event.target === overlay) {
        close({ kind: 'cancelled', source: 'host-tree', paths: [], names: [] });
      }
    });

    cancelBtn.addEventListener('click', () =>
      close({ kind: 'cancelled', source: 'host-tree', paths: [], names: [] }),
    );

    confirmBtn.addEventListener('click', () => {
      if (confirmBtn.disabled) return;
      const paths = directory ? [currentPath] : Array.from(selected);
      close({
        kind: 'picked',
        source: 'host-tree',
        paths,
        names: paths.map(path => path.split(/[\\/]/).filter(Boolean).pop() || path),
      });
    });

    const render = (payload: HostBrowsePayload) => {
      if (!payload || typeof payload.currentPath !== 'string' || !payload.currentPath
        || !Array.isArray(payload.roots) || !Array.isArray(payload.entries)) {
        throw new Error('宿主返回的目录数据无效');
      }
      currentPath = payload.currentPath;
      pathEl.textContent = currentPath;
      body.replaceChildren();

      if (payload.parentPath) {
        const upRow = document.createElement('div');
        upRow.className = 'otools-host-tree-entry otools-host-tree-up';
        upRow.setAttribute('data-host-tree-up', '');
        upRow.setAttribute('data-path', payload.parentPath);
        upRow.setAttribute('data-kind', 'directory');
        upRow.textContent = '↑ 上一级';
        body.appendChild(upRow);
      }

      for (const root of payload.roots) {
        const row = document.createElement('div');
        row.className = 'otools-host-tree-entry otools-host-tree-root';
        row.setAttribute('data-host-tree-root', '');
        row.setAttribute('data-path', root.path);
        row.setAttribute('data-kind', 'directory');
        row.textContent = `📁 ${root.name}  (${root.path})`;
        body.appendChild(row);
      }

      const visible = payload.entries.filter((entry) =>
        (entry.kind === 'file' || entry.kind === 'directory')
          && matchesFilter(entry, options.filters),
      );
      for (const entry of visible) {
        const row = document.createElement('div');
        row.className = 'otools-host-tree-entry';
        row.setAttribute('data-host-tree-entry', '');
        row.setAttribute('data-path', entry.path);
        row.setAttribute('data-kind', entry.kind);
        const label = document.createElement('span');
        label.className = 'otools-host-tree-entry-label';
        label.textContent = entry.kind === 'directory' ? `📁 ${entry.name}` : `📄 ${entry.name}`;
        row.appendChild(label);
        if (!directory && entry.kind === 'file') {
          row.setAttribute('aria-selected', 'false');
          const check = document.createElement('span');
          check.className = 'otools-host-tree-check';
          check.setAttribute('data-host-tree-check', '');
          check.setAttribute('aria-hidden', 'true');
          check.textContent = '✓';
          check.hidden = true;
          row.appendChild(check);
        }
        body.appendChild(row);
      }

      if (!visible.length) {
        const empty = document.createElement('div');
        empty.className = 'otools-host-tree-empty';
        empty.textContent = '该目录为空';
        body.appendChild(empty);
      }
    };

    const load = async (path: string) => {
      if (closed) return;
      const id = ++requestId;
      requestedPath = path;
      ready = false;
      selected.clear();
      updateConfirm();
      statusEl.hidden = true;
      body.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'otools-host-tree-empty';
      loading.textContent = '正在读取目录…';
      body.appendChild(loading);
      try {
        const payload = await browseHostDir(path);
        if (closed || id !== requestId) return;
        render(payload);
        ready = true;
        updateConfirm();
      } catch (error) {
        if (closed || id !== requestId) return;
        body.replaceChildren();
        statusText.textContent = `无法读取宿主目录：${error instanceof Error ? error.message : String(error)}`;
        statusEl.hidden = false;
      }
    };

    retryBtn.addEventListener('click', () => void load(requestedPath));

    // Keep selection and navigation inside the current webview, without opening
    // a native dialog that takes focus away from the host Panel.
    body.addEventListener('click', (event) => {
      if (!ready || !(event.target instanceof Element)) return;
      const row = event.target.closest(
        '[data-host-tree-entry],[data-host-tree-root],[data-host-tree-up]',
      ) as HTMLElement | null;
      if (!row || !body.contains(row)) return;
      const path = row.getAttribute('data-path') || '';
      const kind = row.getAttribute('data-kind');
      if (!path) return;
      if (kind === 'directory') {
        void load(path);
      } else if (!directory && kind === 'file') {
        if (multiple) {
          if (selected.has(path)) selected.delete(path);
          else selected.add(path);
        } else {
          selected.clear();
          selected.add(path);
        }
        body.querySelectorAll<HTMLElement>('[data-host-tree-entry]').forEach(entry => {
          const isSelected = selected.has(entry.getAttribute('data-path') || '');
          entry.classList.toggle('otools-host-tree-selected', isSelected);
          if (entry.getAttribute('data-kind') === 'file') entry.setAttribute('aria-selected', String(isSelected));
          const check = entry.querySelector<HTMLElement>('[data-host-tree-check]');
          if (check) check.hidden = !isSelected;
        });
        updateConfirm();
      }
    });

    document.body.appendChild(overlay);
    void load(requestedPath);
  });
}

// 让宿主 `dialog.open` 的回落链能复用这棵 DOM 树：所有打包了本 SDK 的插件在
// 导入时自动把渲染器挂上去，远程 / 纯浏览器里 `dialog.open` 就会落到这里。
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__otoolsHostTree = pickFromHostTree;
}

const HOST_TREE_CSS = `
.otools-host-tree-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483000;
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.otools-host-tree-panel {
  width: min(560px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  color: #1d1d1f;
}
.otools-host-tree-header {
  padding: 14px 18px 10px;
  border-bottom: 1px solid #ececec;
}
.otools-host-tree-title {
  font-size: 15px;
  font-weight: 600;
}
.otools-host-tree-path {
  margin-top: 4px;
  font-size: 12px;
  color: #6b6b70;
  word-break: break-all;
}
.otools-host-tree-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #b42318;
}
.otools-host-tree-status[hidden] { display: none; }
.otools-host-tree-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 6px 8px;
  min-height: 220px;
}
.otools-host-tree-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.otools-host-tree-entry:hover {
  background: #f2f2f4;
}
.otools-host-tree-up,
.otools-host-tree-root {
  color: #2b6fff;
}
.otools-host-tree-selected {
  background: #dbeafe !important;
  color: #174ea6 !important;
  box-shadow: inset 3px 0 #2563eb;
  font-weight: 600;
}
.otools-host-tree-entry-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.otools-host-tree-check { color: #174ea6; font-weight: 700; }
.otools-host-tree-check[hidden] { display: none; }
.otools-host-tree-current {
  background: #dbeafe;
  color: #174ea6;
  border-radius: 6px;
  padding: 6px 8px;
}
.otools-host-tree-selection {
  flex: 1;
  min-width: 0;
  color: #174ea6;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.otools-host-tree-empty {
  padding: 18px 10px;
  text-align: center;
  color: #9a9aa0;
  font-size: 13px;
}
.otools-host-tree-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #ececec;
}
.otools-host-tree-btn {
  padding: 7px 16px;
  border: 1px solid #d6d6da;
  border-radius: 8px;
  background: #f7f7f9;
  font-size: 13px;
  cursor: pointer;
}
.otools-host-tree-btn-primary {
  background: #2b6fff;
  border-color: #2b6fff;
  color: #fff;
}
.otools-host-tree-btn-primary:disabled {
  background: #b9c8ee;
  border-color: #b9c8ee;
  cursor: not-allowed;
}
`;
