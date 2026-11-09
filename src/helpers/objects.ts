import { createHash } from "node:crypto";

export const getObjectPath = (objectId: string) => {
    const hash = createHash("sha256")
        .update(objectId)
        .digest("hex");

    return `${hash.slice(0, 2)}/${objectId}`;
}