class Progressbar {
    progressBarEl;
    innerBarEl;
    statusEl;
    status = '';
    currentProgress;
    constructor(id) {
        this.progressBarEl = document.getElementById(id);
        if (!this.progressBarEl) {
            throw new Error(`No such element: #${id}`);
        }
        if (!this.progressBarEl.classList.contains('progress-bar')) {
            throw new Error(`Element #${id} is not a progress bar`);
        }
        this.statusEl = this.progressBarEl.querySelector('.progress-status');
        if (!this.statusEl) {
            this.statusEl = document.createElement('span');
            this.statusEl.classList.add('progress-status');
            this.progressBarEl.appendChild(this.statusEl);
        }
        this.innerBarEl = this.progressBarEl.querySelector('.progress-bar-inner');
        if (!this.innerBarEl) {
            this.innerBarEl = document.createElement('div');
            this.innerBarEl.classList.add('progress-bar-inner');
            this.progressBarEl.appendChild(this.innerBarEl);
        }
    }
    /**
     * @param progress 进度百分比, 0~100
     */
    updateProgress(progress) {
        this.currentProgress = Math.min(Math.max(progress, 0), 100);
        this.innerBarEl.style.width = this.currentProgress + '%';
        this.statusEl.textContent =
            `${this.status} (${Math.round(this.currentProgress * 100) / 100}%)`;
    }
    /**
     * @param status 进度条状态文字
     */
    updateStatus(status) {
        this.status = status;
        this.statusEl.textContent =
            `${this.status} (${Math.round(this.currentProgress * 100) / 100}%)`;
    }
}
