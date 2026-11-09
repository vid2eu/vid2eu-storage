import repository from './videos.repository.ts';
import { verifyJwt } from '../../helpers/token.ts';
import { HttpError } from '../../helpers/errors.ts';
import { isAbsolute, relative, resolve } from 'node:path';
import { rm } from 'node:fs/promises';

const STORAGE_ROOT = process.env.STORAGE_ROOT;

const insideStorage = (path: string) => {
    const rel = relative(STORAGE_ROOT, path);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

export async function deleteVideos(jwt: string, videoIds: string[]) {
    const payload = await verifyJwt(jwt);

    if (!payload?.userId) {
        throw new HttpError(401, 'Invalid JWT');
    }

    const requester = await repository.getUserById(payload.userId);

    if (!requester) {
        throw new HttpError(401, 'Invalid user');
    }

    const videos = await repository.getVideos(videoIds);

    if (!requester.isAdmin && videos.some((v) => v.userId !== requester.id)) {
        throw new HttpError(403, 'You can only delete your own videos');
    }

    if (videos.length === 0) {
        return { deleted: 0, files: 0, failedFiles: 0 };
    }

    const keys = await repository.deleteVideos(videos.map((v) => v.id));

    let files = 0;
    let failedFiles = 0;

    for (const key of keys) {
        const path = resolve(STORAGE_ROOT, key);

        if (!insideStorage(path)) {
            console.warn(`Refusing to delete ${path}: outside STORAGE_ROOT`);
            failedFiles++;
            continue;
        }

        try {
            await rm(path, { force: true });
            await rm(`${path}.part`, { force: true });
            files++;
        } catch (error) {
            console.error(`Could not delete ${path}:`, error);
            failedFiles++;
        }
    }

    return { deleted: videos.length, files, failedFiles };
}
