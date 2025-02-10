// @ts-ignore
const {invoke} = window.__TAURI__.core;
// todo record 右键菜单
//   - 提供路径复制功能
type DiffNode = {
    path: string,
    kind: 'New' | 'Removed' | 'Changed' | 'FileGroup' | string,
    folder: boolean,
    delta_size: number,
    delta_alloc: number,
    delta_n_files: number,
    delta_n_folders: number,

    children: DiffNode[] | null, // 节点 init 后为 null, fetchNodes 之后为 DiffNode[] (可能为空数组)
    name: string, // 文件夹/文件/磁盘 名
    expanded: boolean, // 是否在表格中展开
}

// todo 懒显示, 在视口外的节点不渲染
let data: DiffNode[] | null = null;

class DiffTableRenderer {
    private tableEl: HTMLTableElement;
    private tableBodyEl: HTMLTableSectionElement;
    private sortState: {
        field: "path" | "kind" | "size" | "alloc" | "files" | "folders" | string,
        asc: boolean
    };

    constructor(tableEl: HTMLTableElement) {
        this.tableEl = tableEl;
        this.tableBodyEl = this.tableEl.querySelector(".diff-body");
        this.sortState = {field: "size", asc: false};
        this.init();
    }

    private init() {
        this.setupResizableColumns();
        this.renderData().then(() => {
            this.setupSorting();
        });
    }

    private initNode(node: DiffNode) {
        node.expanded = false;
        node.children = null;
        node.name = getNameComponent(node.path);
    }

    /**
     * nodes 中不能有 kind === "FileGroup" 的节点, 否则会自动丢弃 FileGroup 节点.
     */
    private groupFileNodes(nodes: DiffNode[]) {
        const newFiles: DiffNode[] = [];
        const removedFiles: DiffNode[] = [];
        const changedFiles: DiffNode[] = [];
        const folders: DiffNode[] = [];

        let delta_size = 0;
        let delta_alloc = 0;
        let sampleFile: DiffNode = null;
        for (const node of nodes) {
            if (!node.folder) {
                if (sampleFile === null) {
                    sampleFile = node;
                }
                delta_size += node.delta_size;
                delta_alloc += node.delta_alloc;
                if (node.kind === 'New') {
                    newFiles.push(node);
                } else if (node.kind === "Removed") {
                    removedFiles.push(node);
                } else if (node.kind === "Changed") {
                    changedFiles.push(node);
                }
            } else {
                folders.push(node);
            }
        }
        nodes.length = 0;
        nodes.push(...folders);
        let totalLen = newFiles.length + removedFiles.length + changedFiles.length;
        if (totalLen === 0) {
            return;
        }
        const dummyFileGroupNode: DiffNode = {
            kind: "FileGroup",
            delta_n_files: newFiles.length - removedFiles.length,
            delta_n_folders: 0,
            delta_size,
            delta_alloc,
            folder: false,
            path: sampleFile.path + "... [File Group]",
            name: `[${totalLen} file diff nodes]`,
            children: [
                ...newFiles,
                ...removedFiles,
                ...changedFiles
            ],
            expanded: false
        }
        nodes.push(dummyFileGroupNode);
    }

    private async fetchRootNodes(): Promise<void> {
        const nodes: DiffNode[] = await invoke("get_diff_root_nodes", {});
        nodes.forEach(this.initNode);
        this.groupFileNodes(nodes);
        data = nodes;
    }

    private async fetchNodes(node: DiffNode): Promise<void> {
        const nodes: DiffNode[] = await invoke("get_diff_nodes", {path: node.path});
        nodes.forEach(this.initNode);
        this.groupFileNodes(nodes)
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

    private async renderNode(nodeData: DiffNode, depth = 0, parentKey = 'root') {
        if (nodeData.children === null) {
            await this.fetchNodes(nodeData);
        }
        this.sortNodeArray(nodeData.children);
        const row = this.createRow(nodeData, depth, parentKey);
        this.tableBodyEl.appendChild(row);
        if (nodeData.children && nodeData.expanded) {
            for (const child of nodeData.children) {
                await this.renderNode(child, depth + 1, parentKey + '/' + nodeData.name);
            }
        }
    }

    private createRow(nodeData: DiffNode, depth: number, parentKey: string) {
        const row = document.createElement('tr');
        row.dataset.depth = depth.toString();
        row.dataset.parentKey = parentKey;

        const pathCell = document.createElement('td');
        this.inflatePathCell(pathCell, nodeData, depth);
        row.appendChild(pathCell);

        row.appendChild(this.createCell(nodeData.kind));
        row.appendChild(this.createDeltaCell(nodeData.delta_size, true));
        row.appendChild(this.createDeltaCell(nodeData.delta_alloc, true));
        row.appendChild(this.createDeltaCell(nodeData.delta_n_files));
        row.appendChild(this.createDeltaCell(nodeData.delta_n_folders));
        return row;
    }

    private createCell(text: string) {
        const cell = document.createElement('td');
        cell.classList.add(text.toLowerCase()); // in diff.css: .new, .removed, .changed
        cell.textContent = text;
        return cell;
    }

    private createDeltaCell(deltaValue: number, toBytesString: boolean = false) {
        const cell = document.createElement('td');
        if (deltaValue !== 0) {
            cell.className = deltaValue > 0 ? 'delta-positive' : 'delta-negative';
        }
        if (toBytesString) {
            cell.textContent = bytesToString(deltaValue);
        } else {
            cell.textContent = `${deltaValue}`;
        }
        if (deltaValue > 0) {
            cell.textContent = '+' + cell.textContent;
        }
        return cell;
    }

    private inflatePathCell(cell: HTMLTableCellElement, node: DiffNode, depth: number) {
        const indent = document.createElement('span');
        indent.classList.add("indent")
        // depth + 1 是为了让 toggle 能够有位置显示.
        const indentWidth = ((depth + 1) * 20) + 'px';
        indent.style.width = indentWidth;
        indent.style.minWidth = indentWidth;
        const icon = document.createElement("span");
        let isFileGroup = node.kind === "FileGroup";
        if (!isFileGroup) {
            icon.classList.add(node.folder ? "diff-node-icon-folder" : "diff-node-icon-file");
        } else {
            icon.classList.add("diff-node-icon-file-group");
        }
        const name = document.createElement("span");
        name.textContent = node.name;
        cell.appendChild(indent);
        const innerCell = document.createElement("span");
        innerCell.classList.add("path");
        if (node.folder || isFileGroup) {
            const toggle = document.createElement("span");
            toggle.classList.add("diff-node-expand-toggle");
            toggle.textContent = node.expanded ? '▼' : '▶';
            toggle.addEventListener('click', () => {
                this.toggleExpand(node)
            });
            innerCell.appendChild(toggle);
        }
        innerCell.appendChild(icon);
        innerCell.appendChild(name);
        cell.appendChild(innerCell);
    }

    toggleExpand(node: DiffNode) {
        node.expanded = !node.expanded;
        this.renderData().then();
    }

    private setupResizableColumns() {
        const cols = this.tableEl.querySelectorAll('th');
        cols.forEach((header, index: number) => {
            const col = this.tableEl.querySelector(`col:nth-of-type(${index + 1})`) as HTMLTableColElement;
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            header.appendChild(handle);

            let startX = 0;
            let startWidth = 0;

            handle.addEventListener('mousedown', (e: MouseEvent) => {
                e.stopPropagation();
                startX = e.clientX;
                startWidth = getStyleLikeWidth(col);
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                // @ts-ignore 临时禁用点击事件, 防止意外触发排序
                header.removeEventListener('click', header.clickListener);
            });

            const onMouseMove = (e: MouseEvent) => {
                e.stopPropagation();
                let newWidth = startWidth + (e.clientX - startX);
                if (newWidth < 0) {
                    newWidth = 0;
                }
                col.style.width = newWidth + 'px';
            };

            const onMouseUp = (e: MouseEvent) => {
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

    private setupSorting() {
        this.tableEl.querySelectorAll('th.sortable').forEach((header: HTMLTableSectionElement) => {
            const orderIcon = document.createElement('span');
            orderIcon.classList.add("sort-order-icon");
            orderIcon.textContent = '';
            header.appendChild(orderIcon);
            const listener = (_?: MouseEvent) => {
                const field = header.dataset.sort;
                const asc = this.sortState.field === field
                    ? !this.sortState.asc
                    : true;
                this.tableEl.querySelectorAll('th.sortable').forEach((h: HTMLTableCellElement) => {
                    if (h.classList.contains('sort-asc') || h.classList.contains('sort-desc')) {
                        h.classList.remove('sort-asc', 'sort-desc');
                        h.querySelector('span.sort-order-icon').textContent = '';
                    }
                });

                header.classList.add(`sort-${asc ? 'asc' : 'desc'}`);
                if (asc) {
                    orderIcon.textContent = "▲";
                } else {
                    orderIcon.textContent = "▼";
                }
                this.sortState = {field, asc};
                this.renderData().then();
            };
            // @ts-ignore
            header.clickListener = listener;
            header.addEventListener('click', listener);

            // 初始时安装 预先设置的 field 和顺序进行排序
            if (header.dataset.sort === this.sortState.field) {
                this.sortState.asc = !this.sortState.asc; // 提前置反一次
                listener();
            }
        });
    }

    private sortNodes(onlyExpanded: boolean = true) {
        console.log('Sorting by:', this.sortState);
        if (data === null) {
            return;
        }
        this.sortNodeArray(data);
        for (const node of data) {
            this.sortNodesUnder(node, onlyExpanded);
        }
    }

    /**
     * 仅对列表的节点进行排序
     */
    private sortNodeArray(nodes: DiffNode[]) {
        nodes.sort((a: DiffNode, b: DiffNode) => {
            let rst = NaN;
            if (this.sortState.field === "path") {
                // 如果使用 path 排序, 则文件夹优先
                if (a.folder && !b.folder) {
                    rst = -1;
                } else if (!a.folder && b.folder) {
                    rst = 1;
                } else {
                    rst = a.path.localeCompare(b.path);
                }
            } else if (this.sortState.field === "kind") {
                rst = a.kind.localeCompare(b.kind);
            } else if (this.sortState.field === "size") {
                rst = a.delta_size - b.delta_size;
            } else if (this.sortState.field === "alloc") {
                rst = a.delta_alloc - b.delta_alloc;
            } else if (this.sortState.field === "files") {
                rst = a.delta_n_files - b.delta_n_files;
            } else if (this.sortState.field === "folders") {
                rst = a.delta_n_folders - b.delta_n_folders;
            } else {
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
    }

    private sortNodesUnder(node: DiffNode, onlyExpanded: boolean = true) {
        if (node.children === null) {
            return;
        }
        this.sortNodeArray(node.children);
        if (onlyExpanded && node.expanded) {
            for (const child of node.children) {
                this.sortNodesUnder(child, onlyExpanded);
            }
        }
    }
}

window.addEventListener("DOMContentLoaded", async (_) => {
    new DiffTableRenderer(document.getElementById("diff-table") as HTMLTableElement);
});