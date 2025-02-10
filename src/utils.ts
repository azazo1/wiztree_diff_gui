function getFileNameComponent(path: string): string {
    const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
    return parts[parts.length - 1];
}