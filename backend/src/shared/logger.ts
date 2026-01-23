export function log(...args: any[]) {
    if (process.env.NODE_ENV === "test") return;
    console.log(...args);
}

export function warn(...args: any[]) {
    if (process.env.NODE_ENV === "test") return;
    console.warn(...args);
}

export function error(...args: any[]) {
    if (process.env.NODE_ENV === "test") return;
    console.error(...args);
}
