export class HttpError extends Error {
    statusCode: number;
    headers?: Record<string, string>;

    constructor(statusCode: number, message: string, headers?: Record<string, string>) {
        super(message);
        this.statusCode = statusCode;
        this.headers = headers;
    }
}
