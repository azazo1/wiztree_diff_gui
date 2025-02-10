// @ts-ignore
const {invoke} = window.__TAURI__.core;

type DiffNode = {
    path: string,
    kind: 'New' | 'Removed' | 'Changed' | string,
    folder: boolean,
    delta_size: number,
    delta_alloc: number,
    delta_n_files: number,
    delta_n_folders: number,

    children: DiffNode[],
    expanded: boolean
}

let data: DiffNode[] = [];

class DiffTableRenderer {
    private tableEl: HTMLTableElement;
    private tableBodyEl: HTMLTableSectionElement;
    private sortState: {
        field: "path" | "kind" | "size" | "alloc" | "files" | "folders" | string,
        order: "asc" | "desc" | string,
    };

    constructor(tableEl: HTMLTableElement) {
        this.tableEl = tableEl;
        this.tableBodyEl = this.tableEl.querySelector(".diff-body");
        this.sortState = {field: "size", order: "asc"};
        this.init();
    }

    private init() {
        this.setupResizableColumns();
        this.setupSorting();
        this.renderData();
    }

    renderData() {
        for (const node of data) {
            this.renderNode(node);
        }
    }

    private renderNode(nodeData: DiffNode, depth = 0, parentKey = 'root') {
        const row = this.createRow(nodeData, depth, parentKey);
        this.tableBodyEl.appendChild(row);

        if (nodeData.children.length > 0 && nodeData.expanded) {
            nodeData.children.forEach(child => {
                this.renderNode(child, depth + 1, parentKey + '-' + nodeData.path);
            });
        }
    }

    private createRow(nodeData: DiffNode, depth, parentKey) {
        const row = document.createElement('tr');
        row.dataset.depth = depth;
        row.dataset.parentKey = parentKey;

        const pathCell = document.createElement('td');
        this.inflatePathCell(pathCell, nodeData, depth);
        row.appendChild(pathCell);

        row.appendChild(this.createCell(nodeData.kind));
        row.appendChild(this.createDeltaCell(nodeData.delta_size));
        row.appendChild(this.createDeltaCell(nodeData.delta_alloc));
        row.appendChild(this.createDeltaCell(nodeData.delta_n_files));
        row.appendChild(this.createDeltaCell(nodeData.delta_n_folders));

        if (nodeData.folder) {
            row.classList.add('folder');
            row.querySelector('.diff-node-expand-toggle')
                .addEventListener('click', () => this.toggleFolder(nodeData));
        } else {
            row.classList.add('file');
        }

        return row;
    }

    private createCell(text: string) {
        const cell = document.createElement('td');
        console.log(text.toLowerCase());
        cell.classList.add(text.toLowerCase()); // in diff.css: .new, .removed, .changed
        cell.textContent = text;
        return cell;
    }

    private createDeltaCell(deltaValue: number) {
        const cell = document.createElement('td');
        cell.className = deltaValue >= 0 ? 'delta-positive' : 'delta-negative';
        cell.textContent = `${deltaValue}`;
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
        icon.classList.add(node.folder? "diff-node-icon-folder":"diff-node-icon-file");
        const name = document.createElement("span");
        name.textContent = getFileNameComponent(node.path);
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

    toggleFolder(node: DiffNode) {
        node.expanded = !node.expanded;
        this.tableBodyEl.innerHTML = '';
        // todo 如果展开时没有缓存子节点, 则需要请求后端数据
        this.renderData();
    }

    private setupResizableColumns() {
        const cols = this.tableEl.querySelectorAll('th');
        cols.forEach((header) => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            header.appendChild(handle);

            let startX = 0;
            let startWidth = 0;

            handle.addEventListener('mousedown', (e: MouseEvent) => {
                e.stopPropagation();
                startX = e.clientX;
                startWidth = getStyleLikeWidth(header);
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
                header.style.width = newWidth + 'px';
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
            const listener = (_: MouseEvent) => {
                const field = header.dataset.sort;
                const order = this.sortState.field === field
                    ? (this.sortState.order === 'asc' ? 'desc' : 'asc')
                    : 'asc';
                this.tableEl.querySelectorAll('th.sortable').forEach((h: HTMLTableCellElement) => {
                    if (h.classList.contains('sort-asc') || h.classList.contains('sort-desc')) {
                        h.classList.remove('sort-asc', 'sort-desc');
                        h.querySelector('span.sort-order-icon').textContent = '';
                    }
                });

                header.classList.add(`sort-${order}`);
                if (order === 'asc') {
                    orderIcon.textContent = "▲";
                } else {
                    orderIcon.textContent = "▼";
                }
                this.sortNodes(field, order);
            };
            // @ts-ignore
            header.clickListener = listener;
            header.addEventListener('click', listener);
        });
    }

    private sortNodes(field: string, order: string) {
        this.sortState = {field, order};
        // 排序逻辑需要根据当前层级处理兄弟节点
        // 此处为简化实现，示例数据需要调整结构支持排序
        console.log('Sorting by:', this.sortState);
        // todo 排序时文件夹始终在前面
        // todo 使用其他排序的时候, 使用 deltaSize 作为子排序
    }
}

window.addEventListener("DOMContentLoaded", async (_) => {
    new DiffTableRenderer(document.getElementById("diff-table") as HTMLTableElement);
});