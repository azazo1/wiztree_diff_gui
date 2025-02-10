function getFileNameComponent(path: string): string {
    const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
    return parts[parts.length - 1];
}

function getStyleLikeWidth(element: HTMLElement): number {
    const computedStyle = window.getComputedStyle(element);
    const padding = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
    const border = parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);
    return element.offsetWidth - padding - border;
}