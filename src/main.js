'use strict';
async function getAppVersion() {
    return await invoke("get_app_version", {});
}
async function diff(newerFile, olderFile, channel) {
    return await invoke("diff", { channel, newerFile, olderFile });
}
function createDiffWindow() {
    return invoke("create_diff_window", {});
}
function destroyDiffWindow() {
    return invoke("destroy_diff_window", {});
}
async function zoneFromPosition(physicalPos) {
    const eles = await elementsFromPhysicalPosition(physicalPos);
    const zone = eles.find(ele => {
        return ele.classList.contains("drop-zone");
    });
    if (zone !== undefined) {
        return zone;
    }
    return null;
}
function typingEffect(element, attribute, targetText, interval = 7) {
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
            }
            else {
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
    let newerSnapshotFile = undefined;
    let olderSnapshotFile = undefined;
    const newerFileZone = document.getElementById("newer-file-zone");
    const olderFileZone = document.getElementById("older-file-zone");
    const newerFilePathEl = document.getElementById("newer-file-path");
    const olderFilePathEl = document.getElementById("older-file-path");
    const deselectNewerFileBtn = document.getElementById("deselect-newer-file-btn");
    const deselectOlderFileBtn = document.getElementById("deselect-older-file-btn");
    const newerFileInput = document.getElementById("newer-file-input");
    const olderFileInput = document.getElementById("older-file-input");
    const diffBtn = document.getElementById("diff-btn");
    const versionTextEl = document.getElementById("version-text");
    const progressBar = new Progressbar('diff-progress');
    function clearDragover() {
        newerFileZone.classList.remove("dragover");
        olderFileZone.classList.remove("dragover");
    }
    function syncDiffBtnDisabled() {
        diffBtn.disabled = (newerSnapshotFile === undefined
            || olderSnapshotFile === undefined);
    }
    function vacantProgressBar() {
        progressBar.updateProgress(0);
        progressBar.updateStatus("No tasks");
    }
    function selectFile(isNewer, path) {
        if (path === undefined || path === null || typeof path !== "string") {
            return;
        }
        if (isNewer) {
            newerSnapshotFile = path;
            newerFileZone.classList.add("has-file");
            typingEffect(newerFilePathEl, "innerText", path);
        }
        else {
            olderSnapshotFile = path;
            olderFileZone.classList.add("has-file");
            typingEffect(olderFilePathEl, "innerText", path);
        }
        syncDiffBtnDisabled();
    }
    function deselectFile(isNewer) {
        if (isNewer) {
            // 防止二次点击
            if (newerSnapshotFile !== undefined) {
                typingEffect(newerFilePathEl, "innerText", "").then(() => {
                    newerFileZone.classList.remove("has-file");
                });
            }
            newerSnapshotFile = undefined;
        }
        else {
            if (olderSnapshotFile !== undefined) {
                typingEffect(olderFilePathEl, "innerText", "").then(() => {
                    olderFileZone.classList.remove("has-file");
                });
            }
            olderSnapshotFile = undefined;
        }
        syncDiffBtnDisabled();
    }
    const unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
            const zone = await zoneFromPosition(event.payload.position);
            clearDragover();
            if (zone !== null) {
                zone.classList.add("dragover");
            }
        }
        else if (event.payload.type === "drop") {
            const zone = await zoneFromPosition(event.payload.position);
            clearDragover();
            if (zone === newerFileZone) {
                let path = event.payload.paths[0];
                selectFile(true, path);
            }
            else if (zone === olderFileZone) {
                let path = event.payload.paths[0];
                selectFile(false, path);
            }
        }
        else { // leave
            clearDragover();
        }
    });
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
            filters: [{ extensions: ["csv"], name: "CSV Snapshot File" }],
        });
        selectFile(true, file);
    });
    olderFileInput.addEventListener("click", async (e) => {
        const file = await dialogOpen({
            directory: false,
            multiple: false,
            filters: [{ extensions: ["csv"], name: "CSV Snapshot File" }],
        });
        selectFile(false, file);
    });
    versionTextEl.textContent += await getAppVersion();
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
                showToast("input file not ready", 'error');
                return;
            }
            let channel = new Channel("diff");
            channel.onmessage = (message) => {
                let fileNameComponent = getNameComponent(message.file);
                if (message.msg.type === "Reading") {
                    const biasFile = message.isNewer ? 0.5 : 0;
                    const data = message.msg.data;
                    const fracCur = data.current / data.total;
                    progressBar.updateProgress((fracCur * 0.5 * 0.5 + biasFile) * 100);
                    progressBar.updateStatus(`${fileNameComponent} Reading`);
                }
                else if (message.msg.type === "Processing") {
                    const biasFile = message.isNewer ? 0.5 : 0;
                    const data = message.msg.data;
                    const fracCur = data.current / data.total;
                    progressBar.updateProgress(((fracCur * 0.5 + 0.5) * 0.5 + biasFile) * 100);
                    progressBar.updateStatus(`${fileNameComponent} Processing`);
                }
                else if (message.msg.type === "Start") {
                    progressBar.updateProgress(0);
                    progressBar.updateStatus(`${fileNameComponent} Start`);
                }
                else if (message.msg.type === "Finished") {
                    progressBar.updateProgress(100);
                }
                else {
                    progressBar.updateStatus(`${fileNameComponent} ${message.msg.type}`);
                }
            };
            await diff(newerSnapshotFile, olderSnapshotFile, channel);
            await destroyDiffWindow(); // 关闭之前的窗口(如果有)
            await createDiffWindow();
        }
        catch (e) {
            showToast(e, 'error', 5000);
        }
        finally {
            diffBtn.classList.remove("loading");
            syncDiffBtnDisabled();
        }
    });
    vacantProgressBar();
    bodyFitClient();
});
