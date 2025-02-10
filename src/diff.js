// @ts-ignore
const { invoke } = window.__TAURI__.core;
// todo 懒显示, 在视口外的节点不渲染
let data = null;
class DiffTableRenderer {
    tableEl;
    tableBodyEl;
    sortState;
    constructor(tableEl) {
        this.tableEl = tableEl;
        this.tableBodyEl = this.tableEl.querySelector(".diff-body");
        this.sortState = { field: "size", asc: false };
        this.init();
    }
    init() {
        this.setupResizableColumns();
        this.setupSorting();
        this.renderData().then();
    }
    initNode(node) {
        node.expanded = false;
        node.children = null;
        node.name = getNameComponent(node.path);
    }
    async fetchRootNodes() {
        const nodes = await invoke("get_diff_root_nodes", {});
        nodes.forEach(this.initNode);
        data = nodes;
    }
    async fetchNodes(node) {
        const nodes = await invoke("get_diff_nodes", { path: node.path });
        nodes.forEach(this.initNode);
        node.children = nodes;
    }
    async renderData() {
        this.tableBodyEl.innerHTML = '';
        if (data === null) {
            await this.fetchRootNodes();
            this.sortNodes(true);
        }
        for (const node of data) {
            await this.renderNode(node);
        }
    }
    async renderNode(nodeData, depth = 0, parentKey = 'root') {
        if (nodeData.children === null) {
            await this.fetchNodes(nodeData);
        }
        this.sortNodesUnder(nodeData, true);
        const row = this.createRow(nodeData, depth, parentKey);
        this.tableBodyEl.appendChild(row);
        if (nodeData.children && nodeData.expanded) {
            for (const child of nodeData.children) {
                await this.renderNode(child, depth + 1, parentKey + '/' + nodeData.name);
            }
        }
    }
    createRow(nodeData, depth, parentKey) {
        const row = document.createElement('tr');
        row.dataset.depth = depth;
        row.dataset.parentKey = parentKey;
        const pathCell = document.createElement('td');
        this.inflatePathCell(pathCell, nodeData, depth);
        row.appendChild(pathCell);
        row.appendChild(this.createCell(nodeData.kind));
        row.appendChild(this.createDeltaCell(nodeData.delta_size, true));
        row.appendChild(this.createDeltaCell(nodeData.delta_alloc, true));
        row.appendChild(this.createDeltaCell(nodeData.delta_n_files));
        row.appendChild(this.createDeltaCell(nodeData.delta_n_folders));
        if (nodeData.folder) {
            row.classList.add('folder');
            row.querySelector('.diff-node-expand-toggle')
                .addEventListener('click', () => this.toggleFolder(nodeData));
        }
        else {
            row.classList.add('file');
        }
        return row;
    }
    createCell(text) {
        const cell = document.createElement('td');
        cell.classList.add(text.toLowerCase()); // in diff.css: .new, .removed, .changed
        cell.textContent = text;
        return cell;
    }
    createDeltaCell(deltaValue, toBytesString = false) {
        const cell = document.createElement('td');
        if (deltaValue !== 0) {
            cell.className = deltaValue > 0 ? 'delta-positive' : 'delta-negative';
        }
        if (toBytesString) {
            cell.textContent = bytesToString(deltaValue, true);
        }
        else {
            cell.textContent = `${deltaValue}`;
        }
        return cell;
    }
    inflatePathCell(cell, node, depth) {
        const indent = document.createElement('span');
        indent.classList.add("indent");
        // depth + 1 是为了让 toggle 能够有位置显示.
        const indentWidth = ((depth + 1) * 20) + 'px';
        indent.style.width = indentWidth;
        indent.style.minWidth = indentWidth;
        const icon = document.createElement("span");
        icon.classList.add(node.folder ? "diff-node-icon-folder" : "diff-node-icon-file");
        const name = document.createElement("span");
        name.textContent = getNameComponent(node.path);
        cell.appendChild(indent);
        const innerCell = document.createElement("span");
        innerCell.classList.add("path");
        if (node.folder) {
            const toggle = document.createElement("span");
            toggle.classList.add("diff-node-expand-toggle");
            toggle.textContent = node.expanded ? '▼' : '▶';
            innerCell.appendChild(toggle);
        }
        innerCell.appendChild(icon);
        innerCell.appendChild(name);
        cell.appendChild(innerCell);
    }
    toggleFolder(node) {
        node.expanded = !node.expanded;
        this.renderData().then();
    }
    setupResizableColumns() {
        const cols = this.tableEl.querySelectorAll('th');
        cols.forEach((header) => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            header.appendChild(handle);
            let startX = 0;
            let startWidth = 0;
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                startX = e.clientX;
                startWidth = getStyleLikeWidth(header);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                // @ts-ignore 临时禁用点击事件, 防止意外触发排序
                header.removeEventListener('click', header.clickListener);
            });
            const onMouseMove = (e) => {
                e.stopPropagation();
                let newWidth = startWidth + (e.clientX - startX);
                if (newWidth < 0) {
                    newWidth = 0;
                }
                header.style.width = newWidth + 'px';
            };
            const onMouseUp = (e) => {
                e.stopPropagation();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                setTimeout(() => {
                    // @ts-ignore 太早恢复还是会意外触发点击
                    header.addEventListener('click', header.clickListener);
                }, 100);
            };
        });
    }
    setupSorting() {
        this.tableEl.querySelectorAll('th.sortable').forEach((header) => {
            const orderIcon = document.createElement('span');
            orderIcon.classList.add("sort-order-icon");
            orderIcon.textContent = '';
            header.appendChild(orderIcon);
            const listener = (_) => {
                const field = header.dataset.sort;
                const asc = this.sortState.field === field
                    ? !this.sortState.asc
                    : true;
                this.tableEl.querySelectorAll('th.sortable').forEach((h) => {
                    if (h.classList.contains('sort-asc') || h.classList.contains('sort-desc')) {
                        h.classList.remove('sort-asc', 'sort-desc');
                        h.querySelector('span.sort-order-icon').textContent = '';
                    }
                });
                header.classList.add(`sort-${asc ? 'asc' : 'desc'}`);
                if (asc) {
                    orderIcon.textContent = "▲";
                }
                else {
                    orderIcon.textContent = "▼";
                }
                this.sortState = { field, asc };
                this.renderData().then();
            };
            // @ts-ignore
            header.clickListener = listener;
            header.addEventListener('click', listener);
        });
    }
    sortNodes(onlyExpanded = true) {
        console.log('Sorting by:', this.sortState);
        for (const node of data) {
            this.sortNodesUnder(node, onlyExpanded);
        }
    }
    sortNodesUnder(node, onlyExpanded = true) {
        if (node.children === null) {
            return;
        }
        node.children.sort((a, b) => {
            let rst = NaN;
            if (this.sortState.field === "path") {
                // 如果使用 path 排序, 则文件夹优先
                // todo: 把所有兄弟文件节点整合成一个假节点
                if (a.folder && !b.folder) {
                    rst = -1;
                }
                else if (!a.folder && b.folder) {
                    rst = 1;
                }
                else {
                    rst = a.path.localeCompare(b.path);
                }
            }
            else if (this.sortState.field === "kind") {
                rst = a.kind.localeCompare(b.kind);
            }
            else if (this.sortState.field === "size") {
                rst = a.delta_size - b.delta_size;
            }
            else if (this.sortState.field === "alloc") {
                rst = a.delta_alloc - b.delta_alloc;
            }
            else if (this.sortState.field === "files") {
                rst = a.delta_n_files - b.delta_n_files;
            }
            else if (this.sortState.field === "folders") {
                rst = a.delta_n_folders - b.delta_n_folders;
            }
            else {
                throw new Error(`Unknown sort field ${this.sortState.field}`);
            }
            // 子排序
            if (rst === 0 && this.sortState.field !== "path") {
                rst = a.path.localeCompare(b.path);
            }
            if (rst === 0 && this.sortState.field !== "size") {
                rst = a.delta_size - b.delta_size;
            }
            rst = this.sortState.asc ? rst : -rst;
            return rst;
        });
        if (onlyExpanded && node.expanded) {
            for (const child of node.children) {
                this.sortNodesUnder(child, onlyExpanded);
            }
        }
    }
}
window.addEventListener("DOMContentLoaded", async (_) => {
    new DiffTableRenderer(document.getElementById("diff-table"));
});
