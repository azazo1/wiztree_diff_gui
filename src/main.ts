'use strict';

interface WebviewWindow {
    onDragDropEvent: (callback: (event: DragDropEvent) => void) => Promise<() => void>;
}

interface Window {
    innerPosition: () => Promise<{ x: number, y: number }>
    outerPosition: () => Promise<{ x: number, y: number }>
    scaleFactor: () => Promise<number>
}

interface DragDropEvent {
    event: "tauri://drag-over",
    id: number,
    payload: {
        paths: string[],
        position: {
            type: "Physical" | string,
            x: number,
            y: number
        },
        type: "drop" | "over" | "leave"
    }
}

interface OpenDialogOptions {
    canCreateDirectories?: boolean,
    defaultPath?: string,
    filters?: { name: string, extensions: string[] }[],
    multiple?: boolean,
    directory?: boolean,
    recursive?: boolean,
    title?: string
}

type OpenDialogReturn<T extends OpenDialogOptions> = T['directory'] extends true
    ? T['multiple'] extends true
        ? string[] | null
        : string | null
    : T['multiple'] extends true
        ? string[] | null
        : string | null

type Message = {
    type: "Start",
    data: number,
} | {
    type: "Reading",
    data: {
        current: number,
        delta: number,
        total: number,
    }
} | {
    type: "ReadDone" | "Sorting" | "SortDone" | "Finished" | "Error",
} | {
    type: "Processing",
    data: {
        current: number,
        delta: number,
        total: number,
    }
}

let invoke: (cmd: string, args: object, options?: object) => Promise<any>;
let getCurrentWebview: () => WebviewWindow;
let getCurrentWindow: () => Window;
let dialogOpen: <T extends OpenDialogOptions>(options: OpenDialogOptions) => Promise<OpenDialogReturn<T>>;

type Channel<T> = {};
// @ts-ignore
const Channel: Channel = window.__TAURI__.core.Channel;

try {
    // @ts-ignore
    invoke = window.__TAURI__.core.invoke;
    // @ts-ignore
    getCurrentWebview = window.__TAURI__.webview.getCurrentWebview;
    // @ts-ignore
    getCurrentWindow = window.__TAURI__.window.getCurrentWindow;
    // @ts-ignore
    dialogOpen = window.__TAURI_PLUGIN_DIALOG__.open;
} catch (e) {
    console.error(`Importing Tauri failed, ${e}`);
}

async function getAppVersion(): Promise<string> {
    return await invoke("get_app_version", {});
}

async function diff(newerFile: string, olderFile: string, channel: Channel<object>): Promise<void> {
    return await invoke("diff", {channel, newerFile, olderFile});
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

async function zoneFromPosition(physicalPos: { x: number, y: number }): Promise<Element | null> {
    const eles = await elementsFromPhysicalPosition(physicalPos);
    const zone = eles.find(ele => {
        return ele.classList.contains("drop-zone")
    });
    if (zone !== undefined) {
        return zone;
    }
    return null;
}

function typingEffect(
    element: HTMLElement,
    attribute: string,
    targetText: string,
    interval: number = 7
): Promise<void> {
    const rawText = element[attribute];
    if (typeof rawText !== "string") {
        throw new Error("Attribute must be a string");
    }
    // 找到最长的共同前缀
    let p = 0;
    while (p < rawText.length && p < targetText.length && rawText[p] === targetText[p]) {
        p++;
    }
    return new Promise((resolve) => {
        // 先减后增
        let i = rawText.length;
        let direction = -1;
        const intervalID = setInterval(() => {
            if (direction < 0) {
                if (i <= p) {
                    direction = 1;
                }
                element[attribute] = rawText.slice(0, i);
            } else {
                if (i > targetText.length) {
                    clearInterval(intervalID);
                    resolve();
                    return;
                }
                element[attribute] = targetText.slice(0, i);
            }
            i += direction;
        }, interval);
    });
}

window.addEventListener("DOMContentLoaded", async () => {
    let newerSnapshotFile: string | undefined = undefined;
    let olderSnapshotFile: string | undefined = undefined;
    const newerFileZone = document.getElementById("newer-file-zone");
    const olderFileZone = document.getElementById("older-file-zone");
    const newerFilePath = document.getElementById("newer-file-path");
    const olderFilePath = document.getElementById("older-file-path");
    const deselectNewerFileBtn = document.getElementById("deselect-newer-file-btn");
    const deselectOlderFileBtn = document.getElementById("deselect-older-file-btn");
    const newerFileInput = document.getElementById("newer-file-input");
    const olderFileInput = document.getElementById("older-file-input");
    const diffBtn = document.getElementById("diff-btn") as HTMLButtonElement;
    const versionText = document.getElementById("version-text");

    function clearDragover() {
        newerFileZone.classList.remove("dragover");
        olderFileZone.classList.remove("dragover");
    }

    function syncDiffBtnDisabled() {
        diffBtn.disabled = (
            newerSnapshotFile === undefined
            || olderSnapshotFile === undefined
        );
    }

    function selectFile(isNewer: boolean, path: string | undefined | null) {
        if (path === undefined || path === null || typeof path !== "string") {
            return;
        }
        if (isNewer) {
            newerSnapshotFile = path;
            newerFileZone.classList.add("has-file");
            typingEffect(newerFilePath, "innerText", path);
        } else {
            olderSnapshotFile = path;
            olderFileZone.classList.add("has-file");
            typingEffect(olderFilePath, "innerText", path);
        }
        syncDiffBtnDisabled();
    }

    function deselectFile(isNewer: boolean) {
        if (isNewer) {
            // 防止二次点击
            if (newerSnapshotFile !== undefined) {
                typingEffect(newerFilePath, "innerText", "").then(() => {
                    newerFileZone.classList.remove("has-file");
                });
            }
            newerSnapshotFile = undefined;
        } else {
            if (olderSnapshotFile !== undefined) {
                typingEffect(olderFilePath, "innerText", "").then(() => {
                    olderFileZone.classList.remove("has-file");
                });
            }
            olderSnapshotFile = undefined;
        }
        syncDiffBtnDisabled();
    }

    const unlisten_dragdrop = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
            const zone = await zoneFromPosition(event.payload.position);
            clearDragover();
            if (zone !== null) {
                zone.classList.add("dragover");
            }
        } else if (event.payload.type === "drop") {
            const zone = await zoneFromPosition(event.payload.position);
            clearDragover();
            if (zone === newerFileZone) {
                let path = event.payload.paths[0];
                selectFile(true, path);
            } else if (zone === olderFileZone) {
                let path = event.payload.paths[0];
                selectFile(false, path);
            }
        } else { // leave
            clearDragover();
        }
    })

    deselectNewerFileBtn.addEventListener("click", () => {
        deselectFile(true);
    });
    deselectOlderFileBtn.addEventListener("click", () => {
        deselectFile(false);
    });

    newerFileInput.addEventListener("click", async (e) => {
        const file = await dialogOpen({
            directory: false,
            multiple: false,
            filters: [{extensions: ["csv"], name: "CSV Snapshot File"}],
        });
        selectFile(true, file);
    });
    olderFileInput.addEventListener("click", async (e) => {
        const file = await dialogOpen({
            directory: false,
            multiple: false,
            filters: [{extensions: ["csv"], name: "CSV Snapshot File"}],
        });
        selectFile(false, file);
    });

    versionText.innerText += await getAppVersion();

    const links = document.querySelectorAll('a');
    links.forEach(link => {
        // 排除已手动设置 target 的链接
        if (!link.hasAttribute('target')) {
            link.setAttribute('target', '_blank');
            // 安全建议：添加 rel="noopener noreferrer"
            link.setAttribute('rel', 'noopener noreferrer');
        }
    });

    diffBtn.addEventListener("click", async () => {
        diffBtn.classList.add("loading");
        diffBtn.disabled = true;
        try {
            if (newerSnapshotFile === undefined || olderSnapshotFile === undefined) {
                // unreachable
                showToast("input file not ready");
                return;
            }
            let channel = new Channel<Message>("diff");
            channel.onmessage = (message: Message) => {
                // todo 更新显示进度条
            }
            await diff(newerSnapshotFile, olderSnapshotFile, channel)
            // todo 进入 diff 页面
        } catch (e) {
            showToast(e, 'error', 5000);
        } finally {
            diffBtn.classList.remove("loading");
            syncDiffBtnDisabled();
        }
    });
});