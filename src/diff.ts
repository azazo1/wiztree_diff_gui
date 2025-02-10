type DiffNode = {
    path: string,
    kind: 'New' | 'Removed' | 'Changed' | string,
    folder: boolean,
    deltaSize: number,
    deltaAlloc: number,
    deltaNFiles: number,
    deltaNFolders: number,
    children: DiffNode[],
    expanded: boolean
}
const sampleData = {
    kind: 'Changed',
    folder: true,
    path: '/projects',
    deltaSize: 2048,
    deltaAlloc: 1024,
    deltaNFiles: 3,
    deltaNFolders: 1,
    expanded: true,
    children: [
        {
            kind: 'New',
            folder: false,
            path: '/projects/new_file.txt',
            deltaSize: 512,
            deltaAlloc: 512,
            deltaNFiles: 1,
            deltaNFolders: 0,
            expanded: false,
            children: []
        },
        {
            kind: 'Removed',
            folder: true,
            path: '/projects/old_dir',
            deltaSize: -1024,
            deltaAlloc: -512,
            deltaNFiles: -2,
            deltaNFolders: -1,
            expanded: false,
            children: [
                {
                    kind: 'Changed',
                    folder: false,
                    path: '/projects/old_dir/file.md',
                    deltaSize: 256,
                    deltaAlloc: 0,
                    deltaNFiles: 0,
                    deltaNFolders: 0,
                    expanded: false,
                    children: []
                }
            ]
        },
        {
            kind: 'New',
            folder: false,
            path: '/projects/new_file.txt',
            deltaSize: 512,
            deltaAlloc: 512,
            deltaNFiles: 1,
            deltaNFolders: 0,
            expanded: false,
            children: []
        },
        {
            kind: 'Removed',
            folder: true,
            path: '/projects/old_dir',
            deltaSize: -1024,
            deltaAlloc: -512,
            deltaNFiles: -2,
            deltaNFolders: -1,
            expanded: false,
            children: [
                {
                    kind: 'Changed',
                    folder: false,
                    path: '/projects/old_dir/file.md',
                    deltaSize: 256,
                    deltaAlloc: 0,
                    deltaNFiles: 0,
                    deltaNFolders: 0,
                    expanded: false,
                    children: []
                }
            ]
        }
    ]
};

class DiffTableRenderer {
    private tableEl: HTMLTableElement;
    private tableBodyEl: HTMLTableSectionElement;
    private sortState: {
        field: "path" | "kind" | "size" | "alloc" | "files" | "folders" | string;
        order: "asc" | "desc"
    };

    constructor(tableEl: HTMLTableElement) {
        this.tableEl = tableEl;
        this.tableBodyEl = this.tableEl.querySelector(".diff-body");
        this.sortState = {field: "size", order: "asc"};
        this.init();
    }

    init() {
        this.setupResizableColumns();
        this.setupSorting();
        this.render(sampleData);
    }

    render(nodeData: DiffNode, depth = 0, parentKey = 'root') {
        const row = this.createRow(nodeData, depth, parentKey);
        this.tableBodyEl.appendChild(row);

        if (nodeData.children.length > 0 && nodeData.expanded) {
            nodeData.children.forEach(child => {
                // todo 实现后端数据的获取和缓存
                this.render(child, depth + 1, parentKey + '-' + nodeData.path);
            });
        }
    }

    createRow(nodeData: DiffNode, depth, parentKey) {
        const row = document.createElement('tr');
        row.dataset.depth = depth;
        row.dataset.parentKey = parentKey;

        const pathCell = document.createElement('td');
        this.inflatePathCell(pathCell, nodeData, depth);
        row.appendChild(pathCell);

        row.appendChild(this.createCell(nodeData.kind));
        row.appendChild(this.createDeltaCell(nodeData.deltaSize));
        row.appendChild(this.createDeltaCell(nodeData.deltaAlloc));
        row.appendChild(this.createDeltaCell(nodeData.deltaNFiles));
        row.appendChild(this.createDeltaCell(nodeData.deltaNFolders));

        if (nodeData.folder) {
            row.classList.add('folder');
            row.querySelector('.diff-node-expand-toggle')
                .addEventListener('click', () => this.toggleFolder(nodeData));
        } else {
            row.classList.add('file');
        }

        return row;
    }

    createCell(text: string) {
        const cell = document.createElement('td');
        console.log(text.toLowerCase());
        cell.classList.add(text.toLowerCase()); // in diff.css: .new, .removed, .changed
        cell.textContent = text;
        return cell;
    }

    createDeltaCell(deltaValue: number) {
        const cell = document.createElement('td');
        cell.className = deltaValue >= 0 ? 'delta-positive' : 'delta-negative';
        cell.textContent = `${deltaValue}`;
        return cell;
    }

    inflatePathCell(cell: HTMLTableCellElement, node: DiffNode, depth: number) {
        const indent = document.createElement('span');
        indent.classList.add("indent")
        // depth + 1 是为了让 toggle 能够有位置显示.
        const indentWidth = ((depth + 1) * 20) + 'px';
        indent.style.width = indentWidth;
        indent.style.minWidth = indentWidth;
        const icon = document.createElement("img");
        icon.src = node.folder ? "assets/folder.svg" : "assets/file.svg";
        icon.alt = "";
        icon.classList.add("diff-node-icon");
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
        this.render(sampleData);
    }

    setupResizableColumns() {
        // todo 修复拖动开始是的位移
        // todo 设置最小宽度
        const cols = this.tableEl.querySelectorAll('th');
        cols.forEach((col) => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            col.appendChild(handle);

            let startX = 0;
            let startWidth = 0;

            handle.addEventListener('mousedown', (e) => {
                startX = e.clientX;
                startWidth = col.offsetWidth;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            const onMouseMove = (e) => {
                const newWidth = startWidth + (e.clientX - startX);
                col.style.width = newWidth + 'px';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
        });
    }

    setupSorting() {
        this.tableEl.querySelectorAll('th.sortable').forEach((header: HTMLTableSectionElement) => {
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                const order = this.sortState.field === field
                    ? (this.sortState.order === 'asc' ? 'desc' : 'asc')
                    : 'asc';

                this.tableEl.querySelectorAll('th').forEach(h =>
                    h.classList.remove('sort-asc', 'sort-desc')
                );

                header.classList.add(`sort-${order}`);
                this.sortState = {field, order};
                this.sortNodes();
            });
        });
    }

    sortNodes() {
        // 排序逻辑需要根据当前层级处理兄弟节点
        // 此处为简化实现，示例数据需要调整结构支持排序
        console.log('Sorting by:', this.sortState);
    }
}

window.addEventListener("DOMContentLoaded", async (e) => {
    let tabr = new DiffTableRenderer(document.getElementById("diff-table") as HTMLTableElement);
});