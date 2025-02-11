// 这些变量在其他文件中被使用
// @ts-ignore
const {Channel, invoke} = window.__TAURI__.core;
// @ts-ignore
const {getCurrentWebview} = window.__TAURI__.webview;
// @ts-ignore
const {getCurrentWindow} = window.__TAURI__.window;
// @ts-ignore
let dialogOpen = window.__TAURI_PLUGIN_DIALOG__.open;

/**
 * 磁盘 -> C:
 * 文件名 -> filename.ext
 * 文件夹 -> folder_name
 */
function getNameComponent(path: string): string {
    const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
    return parts[parts.length - 1];
}

function getStyleLikeWidth(element: HTMLElement): number {
    const computedStyle = window.getComputedStyle(element);
    const padding = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
    const border = parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);
    return element.offsetWidth - padding - border;
}

function bytesToString(bytes: number, positiveSign: boolean = false): string {
    let absBytes = Math.abs(bytes);
    if (absBytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(absBytes) / Math.log(k));
    let prefix = "";
    if (positiveSign && bytes > 0) {
        prefix = "+";
    }
    const unitNumber = bytes / Math.pow(k, i);
    return prefix + unitNumber.toFixed(2) + " " + sizes[i];
}

async function offsetOfClientArea(physicalPosition: { x: number, y: number }): Promise<{ x: number, y: number }> {
    // 需要考虑 windows 的窗口缩放, 比如 150% 的缩放相应就要缩小为 1.5 分之一
    const window = getCurrentWindow();
    const x = physicalPosition.x;
    const y = physicalPosition.y;
    const scaleFactor = await window.scaleFactor();
    return {
        x: Math.round(x / scaleFactor),
        y: Math.round(y / scaleFactor)
    };
}

async function elementsFromPhysicalPosition(physicalPosition: { x: number, y: number }): Promise<Element[]> {
    const pos = await offsetOfClientArea(physicalPosition);
    return document.elementsFromPoint(pos.x, pos.y);
}

async function _fit() {
    const win = getCurrentWindow();
    const clientPhysicalSize = await win.innerSize();
    let {width, height} = clientPhysicalSize;
    let scaleFactor = await win.scaleFactor();
    width /= scaleFactor;
    width -= 2 * getScrollbarWidth();
    height /= scaleFactor;
    height -= 2 * getScrollbarWidth();
    document.body.style.width = width + "px";
    document.body.style.height = height + "px";
}

let _scrollbarWidth: number | undefined = undefined;

function getScrollbarWidth() {
    if (_scrollbarWidth !== undefined) {
        return _scrollbarWidth;
    }
    // 创建一个带有滚动条的临时元素
    const scrollDiv = document.createElement('div');
    scrollDiv.style.cssText = `
    width: 100px;
    height: 100px;
    overflow: scroll;
    position: absolute;
    visibility: hidden;
  `;

    // 将元素添加到DOM中以确保渲染
    document.body.appendChild(scrollDiv);

    // 计算滚动条宽度
    _scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

    // 移除临时元素
    document.body.removeChild(scrollDiv);

    return _scrollbarWidth;
}

/**
 * 需要手动设置 body 的 margin 为 0
 */
function bodyFitClient(): void {
    window.removeEventListener('resize', _fit);
    window.removeEventListener('focus', _fit);
    window.addEventListener('resize', _fit);
    window.addEventListener('focus', _fit);
    _fit().then();
}