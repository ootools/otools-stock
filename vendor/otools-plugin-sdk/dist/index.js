import { capture as de } from "./capture.js";
import { AgentError as ue, createAgentApi as fe } from "./agent-factory.js";
import { createAiApi as me } from "./ai-factory.js";
import { createPluginDataApi as we } from "./plugin-data-factory.js";
import { ObservationError as be, createObservationApi as xe } from "./observation-factory.js";
import { createReminderApi as ve } from "./reminder-factory.js";
import { createOtoolsAliasMap as Ae } from "./aliases.js";
import { otoolsTauriShimPlugin as Oe } from "./vite.js";
import { listen as q, invoke as N, listenTauri as $, invokeTauri as M } from "./runtime.js";
import { emit as Se, getOtoolsApi as Pe, isOtoolsPluginRuntime as Ne, openExternal as Le, openPath as Te } from "./runtime.js";
import { pickDirectory as Ue, pickFile as ze, pickFiles as De, pickZipFile as Ie, saveFile as He } from "./dialog.js";
import { CaptureError as Be, createCaptureApi as qe } from "./capture-factory.js";
function U() {
  if (!(typeof window > "u"))
    return window.otools ?? window.utools;
}
async function te(t, e) {
  const o = String(t ?? "").trim();
  if (!o)
    return;
  const r = U();
  if (r?.shellOpen) {
    await r.shellOpen(o, e);
    return;
  }
  if (r?.shellOpenExternal && /^https?:\/\//i.test(o)) {
    r.shellOpenExternal(o);
    return;
  }
  if (r?.shellOpenPath) {
    r.shellOpenPath(o);
    return;
  }
  typeof window < "u" && window.open(o, "_blank", "noopener,noreferrer");
}
async function oe(t) {
  const e = String(t ?? "").trim();
  if (!e)
    return;
  const o = U();
  if (o?.shellOpenPath) {
    o.shellOpenPath(e);
    return;
  }
}
async function ne(t) {
  const e = String(t ?? "").trim();
  if (!e)
    return;
  const o = U();
  if (o?.shellOpenExternal) {
    o.shellOpenExternal(e);
    return;
  }
  typeof window < "u" && window.open(e, "_blank", "noopener,noreferrer");
}
const j = "otools-open-file", I = 3e3;
function W(t) {
  if (!t)
    return [];
  try {
    const o = new URLSearchParams(t).get("otoolsOpenFile");
    if (!o)
      return [];
    const r = JSON.parse(o);
    return Array.isArray(r) ? r.map((a) => String(a || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}
function K(t) {
  return t.map((e) => {
    const o = String(e || "").trim(), r = o.split(/[\\/]/), a = r[r.length - 1] || o, f = a.lastIndexOf("."), p = f > 0 ? a.slice(f + 1).toLowerCase() : "";
    return { path: o, name: a, ext: p };
  });
}
function V() {
  if (typeof window < "u")
    try {
      const t = window.__OToolsEnv, e = typeof t?.pluginUuid == "string" ? t.pluginUuid.trim() : "";
      if (e)
        return e;
      const o = new URLSearchParams(window.location?.search || ""), r = (o.get("plugin") || o.get("pluginUuid") || o.get("plugin_uuid") || "").trim();
      if (r)
        return r;
    } catch {
    }
  return "";
}
async function re(t) {
  const e = /* @__PURE__ */ new Map(), o = (p) => {
    const l = Date.now(), u = [];
    for (const h of p) {
      const c = String(h || "").trim();
      if (!c)
        continue;
      const m = e.get(c);
      typeof m == "number" && l - m < I || (e.set(c, l), u.push(c));
    }
    if (e.size > 256)
      for (const [h, c] of e)
        l - c >= I && e.delete(h);
    u.length && t(K(u));
  }, r = async () => {
    const p = V();
    if (!p)
      return;
    let l = [];
    try {
      const u = await N("otools_consume_open_files", { pluginUuid: p });
      l = Array.isArray(u) ? u.map(String) : [];
    } catch {
      return;
    }
    o(l);
  }, a = await q(j, () => {
    r();
  }), f = W(
    typeof window < "u" && window.location?.search || ""
  );
  return f.length && o(f), r(), a;
}
const J = "otools-keyword-dispatch";
function H() {
  if (typeof window < "u")
    try {
      const t = window.__OToolsEnv, e = typeof t?.pluginUuid == "string" ? t.pluginUuid.trim() : "";
      if (e)
        return e;
      const o = new URLSearchParams(window.location?.search || ""), r = (o.get("plugin") || o.get("pluginUuid") || o.get("plugin_uuid") || "").trim();
      if (r)
        return r;
    } catch {
    }
  return "";
}
const R = /* @__PURE__ */ new Map();
async function se(t) {
  const e = H(), o = typeof window > "u" ? void 0 : window.__TAURI_INTERNALS__?.metadata?.currentWebview?.label, r = JSON.stringify([e.toLowerCase(), o || ""]), a = R.get(r) || { entries: [], consuming: null };
  R.set(r, a);
  const f = a.consuming, p = /* @__PURE__ */ new Set();
  let l = !1, u = !1, h = null;
  const c = (b) => {
    const g = [];
    for (const E of b) {
      if (!E || typeof E != "object")
        continue;
      const d = E;
      typeof d.id != "string" || !d.id.trim() || typeof d.keyword != "string" || !d.keyword.trim() || p.has(d.id) || (p.add(d.id), g.push(d));
    }
    if (p.size > 512) {
      const E = Array.from(p).slice(-256);
      p.clear();
      for (const d of E)
        p.add(d);
    }
    g.length && !l && t(g);
  }, m = () => (u = !0, h || (h = (async () => {
    for (; u && !l; ) {
      if (u = !1, !e)
        return;
      if (!a.consuming) {
        const b = o ? { pluginUuid: e, targetLabel: o } : { pluginUuid: e };
        a.consuming = M("otools_consume_keyword_dispatch", b).then((g) => {
          Array.isArray(g) && a.entries.push(...g);
        }).finally(() => {
          a.consuming = null;
        });
      }
      try {
        await a.consuming;
      } catch {
        continue;
      }
      if (!l) {
        const b = a.entries;
        a.entries = [], c(b);
      }
    }
  })().finally(() => {
    h = null;
  }), h)), x = await $(J, (b) => {
    const g = b?.payload;
    !l && (typeof g != "string" || g.toLowerCase() === H().toLowerCase()) && m();
  });
  return f ? f.catch(() => {
  }).then(() => {
    l || m();
  }) : m(), async () => {
    l = !0, u = !1, await x();
  };
}
async function Y(t) {
  return N("tools_webview_browse_dialog", { request: { path: t ?? "" } });
}
async function ie(t) {
  const e = String(t ?? "").trim();
  if (!e)
    throw new Error("listHostDir requires path");
  return N("tools_webview_list_dir", { path: e });
}
async function ae(t) {
  const e = String(t ?? "").trim();
  if (!e)
    throw new Error("readHostFile requires path");
  return N("tools_webview_read_file", { path: e });
}
const Z = (t, e) => {
  if (!e?.length || t.kind === "directory")
    return !0;
  const o = t.name.includes(".") ? t.name.split(".").pop().toLowerCase() : "";
  return e.some(
    (r) => r.extensions.some((a) => a.trim().toLowerCase().replace(/^\./, "") === o)
  );
};
function G() {
  if (document.getElementById("otools-host-tree-style"))
    return;
  const t = document.createElement("style");
  t.id = "otools-host-tree-style", t.textContent = X, document.head.appendChild(t);
}
async function Q(t) {
  if (typeof document > "u" || !document.body)
    throw new Error("pickFromHostTree requires a DOM document");
  const e = !!t.directory, o = !!t.multiple && !e, r = t.title ?? (e ? "选择目录" : "选择文件");
  return new Promise((a) => {
    let f = "", p = t.startPath ?? "", l = !1, u = !1, h = 0;
    const c = /* @__PURE__ */ new Set();
    G();
    const m = document.createElement("div");
    m.setAttribute("data-host-tree", ""), m.className = "otools-host-tree-overlay";
    const x = document.createElement("div");
    x.className = "otools-host-tree-panel", x.setAttribute("role", "dialog"), x.setAttribute("aria-modal", "true"), x.setAttribute("aria-label", r), m.appendChild(x);
    const b = document.createElement("div");
    b.className = "otools-host-tree-header";
    const g = document.createElement("div");
    g.className = "otools-host-tree-title", g.textContent = r, b.appendChild(g);
    const E = document.createElement("div");
    E.className = "otools-host-tree-path", b.appendChild(E), x.appendChild(b);
    const d = document.createElement("div");
    d.className = "otools-host-tree-status", d.setAttribute("role", "status"), d.hidden = !0;
    const L = document.createElement("span");
    L.setAttribute("data-host-tree-error", "");
    const O = document.createElement("button");
    O.type = "button", O.className = "otools-host-tree-btn", O.textContent = "重试", O.setAttribute("data-host-tree-retry", ""), d.appendChild(L), d.appendChild(O), x.appendChild(d);
    const w = document.createElement("div");
    w.className = "otools-host-tree-body", x.appendChild(w);
    const S = document.createElement("div");
    S.className = "otools-host-tree-footer";
    const C = document.createElement("div");
    C.className = "otools-host-tree-selection", C.setAttribute("data-host-tree-selection", ""), C.setAttribute("role", "status"), C.textContent = e ? "请选择目录" : "请选择文件", S.appendChild(C);
    const _ = document.createElement("button");
    _.type = "button", _.textContent = "取消", _.className = "otools-host-tree-btn", _.setAttribute("data-host-tree-cancel", "");
    const k = document.createElement("button");
    k.type = "button", k.textContent = e ? "选择此目录" : "选择", k.className = "otools-host-tree-btn otools-host-tree-btn-primary", k.setAttribute("data-host-tree-confirm", ""), k.disabled = !0, S.appendChild(_), S.appendChild(k), x.appendChild(S);
    const T = () => {
      k.disabled = !l || (e ? !f : !c.size), E.classList.toggle("otools-host-tree-current", e && l && !!f), C.textContent = e && l ? `已选目录：${f}` : c.size ? `已选 ${c.size} 个文件` : e ? "请选择目录" : "请选择文件", C.title = e && l ? f : "";
    }, P = (s) => {
      u || (u = !0, h += 1, window.removeEventListener("keydown", z, !0), m.remove(), a(s));
    }, z = (s) => {
      s.key === "Escape" && (s.preventDefault(), s.stopImmediatePropagation(), P({ kind: "cancelled", source: "host-tree", paths: [], names: [] }));
    };
    window.addEventListener("keydown", z, !0), m.addEventListener("mousedown", (s) => {
      s.target === m && P({ kind: "cancelled", source: "host-tree", paths: [], names: [] });
    }), _.addEventListener(
      "click",
      () => P({ kind: "cancelled", source: "host-tree", paths: [], names: [] })
    ), k.addEventListener("click", () => {
      if (k.disabled) return;
      const s = e ? [f] : Array.from(c);
      P({
        kind: "picked",
        source: "host-tree",
        paths: s,
        names: s.map((y) => y.split(/[\\/]/).filter(Boolean).pop() || y)
      });
    });
    const B = (s) => {
      if (!s || typeof s.currentPath != "string" || !s.currentPath || !Array.isArray(s.roots) || !Array.isArray(s.entries))
        throw new Error("宿主返回的目录数据无效");
      if (f = s.currentPath, E.textContent = f, w.replaceChildren(), s.parentPath) {
        const n = document.createElement("div");
        n.className = "otools-host-tree-entry otools-host-tree-up", n.setAttribute("data-host-tree-up", ""), n.setAttribute("data-path", s.parentPath), n.setAttribute("data-kind", "directory"), n.textContent = "↑ 上一级", w.appendChild(n);
      }
      for (const n of s.roots) {
        const i = document.createElement("div");
        i.className = "otools-host-tree-entry otools-host-tree-root", i.setAttribute("data-host-tree-root", ""), i.setAttribute("data-path", n.path), i.setAttribute("data-kind", "directory"), i.textContent = `📁 ${n.name}  (${n.path})`, w.appendChild(i);
      }
      const y = s.entries.filter(
        (n) => (n.kind === "file" || n.kind === "directory") && Z(n, t.filters)
      );
      for (const n of y) {
        const i = document.createElement("div");
        i.className = "otools-host-tree-entry", i.setAttribute("data-host-tree-entry", ""), i.setAttribute("data-path", n.path), i.setAttribute("data-kind", n.kind);
        const A = document.createElement("span");
        if (A.className = "otools-host-tree-entry-label", A.textContent = n.kind === "directory" ? `📁 ${n.name}` : `📄 ${n.name}`, i.appendChild(A), !e && n.kind === "file") {
          i.setAttribute("aria-selected", "false");
          const v = document.createElement("span");
          v.className = "otools-host-tree-check", v.setAttribute("data-host-tree-check", ""), v.setAttribute("aria-hidden", "true"), v.textContent = "✓", v.hidden = !0, i.appendChild(v);
        }
        w.appendChild(i);
      }
      if (!y.length) {
        const n = document.createElement("div");
        n.className = "otools-host-tree-empty", n.textContent = "该目录为空", w.appendChild(n);
      }
    }, F = async (s) => {
      if (u) return;
      const y = ++h;
      p = s, l = !1, c.clear(), T(), d.hidden = !0, w.replaceChildren();
      const n = document.createElement("div");
      n.className = "otools-host-tree-empty", n.textContent = "正在读取目录…", w.appendChild(n);
      try {
        const i = await Y(s);
        if (u || y !== h) return;
        B(i), l = !0, T();
      } catch (i) {
        if (u || y !== h) return;
        w.replaceChildren(), L.textContent = `无法读取宿主目录：${i instanceof Error ? i.message : String(i)}`, d.hidden = !1;
      }
    };
    O.addEventListener("click", () => {
      F(p);
    }), w.addEventListener("click", (s) => {
      if (!l || !(s.target instanceof Element)) return;
      const y = s.target.closest(
        "[data-host-tree-entry],[data-host-tree-root],[data-host-tree-up]"
      );
      if (!y || !w.contains(y)) return;
      const n = y.getAttribute("data-path") || "", i = y.getAttribute("data-kind");
      n && (i === "directory" ? F(n) : !e && i === "file" && (o ? c.has(n) ? c.delete(n) : c.add(n) : (c.clear(), c.add(n)), w.querySelectorAll("[data-host-tree-entry]").forEach((A) => {
        const v = c.has(A.getAttribute("data-path") || "");
        A.classList.toggle("otools-host-tree-selected", v), A.getAttribute("data-kind") === "file" && A.setAttribute("aria-selected", String(v));
        const D = A.querySelector("[data-host-tree-check]");
        D && (D.hidden = !v);
      }), T()));
    }), document.body.appendChild(m), F(p);
  });
}
typeof window < "u" && (window.__otoolsHostTree = Q);
const X = `
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
export {
  ue as AgentError,
  Be as CaptureError,
  j as OTOOLS_FILE_DELIVER_EVENT,
  J as OTOOLS_KEYWORD_DISPATCH_EVENT,
  be as ObservationError,
  Y as browseHostDir,
  de as capture,
  fe as createAgentApi,
  me as createAiApi,
  qe as createCaptureApi,
  xe as createObservationApi,
  Ae as createOtoolsAliasMap,
  we as createPluginDataApi,
  ve as createReminderApi,
  Se as emit,
  Pe as getOtoolsApi,
  N as invoke,
  Ne as isOtoolsPluginRuntime,
  ie as listHostDir,
  q as listen,
  se as onOtoolsKeyword,
  re as onOtoolsOpenFile,
  Le as openExternal,
  Te as openPath,
  Oe as otoolsTauriShimPlugin,
  W as parseLaunchOpenFiles,
  Ue as pickDirectory,
  ze as pickFile,
  De as pickFiles,
  Q as pickFromHostTree,
  Ie as pickZipFile,
  ae as readHostFile,
  He as saveFile,
  te as shellOpen,
  ne as shellOpenExternal,
  oe as shellOpenPath,
  K as toOpenFileEntries
};
//# sourceMappingURL=index.js.map
