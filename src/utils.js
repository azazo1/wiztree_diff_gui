function getFileNameComponent(path) {
    const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
    return parts[parts.length - 1];
}
