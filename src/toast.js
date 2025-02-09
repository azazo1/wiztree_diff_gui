/**
 * 弹窗消失时返回, 返回用户是否点击了关闭按钮.
 * */
async function showToast(message, type = 'info', duration = 3000) {
    return new Promise((resolve) => {
        console.log(`toasted ${type}:`);
        console.log(message);
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        // @ts-ignore
        toast.resolvePromise = resolve;
        toast.innerHTML = `
            <span class="toast-icon"></span>
            <div class="toast-text">${JSON.stringify(message)}</div>
            <span class="toast-close" onclick="
                this.parentElement.classList.remove('show');
                this.parentElement.resolvePromise(true);
            ">&times;</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); // 为了触发动画, 不能立刻添加
        setTimeout(() => {
            if (toast.classList.contains('show')) {
                toast.classList.remove('show');
                resolve(false);
            }
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, duration);
    });
}
