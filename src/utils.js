/**
 * 磁盘 -> C:
 * 文件名 -> filename.ext
 * 文件夹 -> folder_name
 */
function getNameComponent(path) {
    const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
    return parts[parts.length - 1];
}
function getStyleLikeWidth(element) {
    const computedStyle = window.getComputedStyle(element);
    const padding = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
    const border = parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);
    return element.offsetWidth - padding - border;
}
function bytesToString(bytes, positiveSign = false) {
    let absBytes = Math.abs(bytes);
    if (absBytes === 0)
        return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(absBytes) / Math.log(k));
    let prefix = "";
    if (positiveSign && bytes > 0) {
        prefix = "+";
    }
    return prefix + (bytes / Math.pow(k, i)).toPrecision(3) + " " + sizes[i];
}
