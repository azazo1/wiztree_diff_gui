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

let invoke: (cmd: string, args: object, options?: object) => Promise<any>;
let getCurrentWebview: () => WebviewWindow;
let getCurrentWindow: () => Window;
let dialogOpen: (options: OpenDialogOptions) => Promise<string[] | string | null>;
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

    function clearDragover() {
        newerFileZone.classList.remove("dragover");
        olderFileZone.classList.remove("dragover");
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
                if (path !== undefined) {
                    newerSnapshotFile = path;
                    newerFileZone.classList.add("has-file");
                    newerFilePath.innerText = path;
                }
            } else if (zone === olderFileZone) {
                let path = event.payload.paths[0];
                if (path !== undefined) {
                    olderSnapshotFile = path;
                    olderFileZone.classList.add("has-file");
                    olderFilePath.innerText = path;
                }
            }
        } else { // leave
            clearDragover();
        }
    })

    deselectNewerFileBtn.addEventListener("click", () => {
        newerSnapshotFile = undefined;
        newerFileZone.classList.remove("has-file");
        newerFilePath.innerText = "";
    });
    deselectOlderFileBtn.addEventListener("click", () => {
        olderSnapshotFile = undefined;
        olderFileZone.classList.remove("has-file");
        olderFilePath.innerText = "";
    });

    newerFileInput.addEventListener("click", async (e) => {
        const file = await dialogOpen({
            directory: false,
            multiple: false,
            filters: [{extensions: ["csv"], name: ""}],
        });
        console.log(file);
        if (file !== undefined && typeof file === "string") {
            newerSnapshotFile = file;
            newerFileZone.classList.add("has-file");
            newerFilePath.innerText = file;
        }
    });
    olderFileInput.addEventListener("click", async (e) => {
        const file = await dialogOpen({
            directory: false,
            multiple: false,
            filters: [{extensions: ["csv"], name: ""}],
        });
        console.log(file);
        if (file !== undefined && typeof file === "string") {
            olderSnapshotFile = file;
            olderFileZone.classList.add("has-file");
            olderFilePath.innerText = file;
        }
    });
});