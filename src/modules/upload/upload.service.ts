import { getObjectPath } from '../../helpers/objects.ts';
import repository from './upload.repository.ts';
import { generateUploadSessionToken, verifyJwt } from '../../helpers/token.ts';
import { HttpError } from '../../helpers/errors.ts';
import createProgressTracker from '../../helpers/tracker.ts';
import { randomUUID } from 'node:crypto';
import type { MultipartFile } from '@fastify/multipart';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { mkdir, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const STORAGE_ROOT = process.env.STORAGE_ROOT;

const PROGRESS_WRITE_INTERVAL_MS = 1000;

type UploadSession = Awaited<ReturnType<typeof repository.getUploadSessionByToken>>[number];

export async function createSession(videoId: string, jwt: string, expectedSize: number) {
    const payload = await verifyJwt(jwt);

    if (!payload || !payload.exp || payload.exp < Date.now() / 1000) {
        throw new HttpError(401, 'Invalid JWT');
    }

    const valid = await repository.checkUserValid(payload.userId);

    if (!valid || valid.length === 0) {
        throw new HttpError(401, 'Invalid user');
    }

    const video = await repository.getVideoByIdWithUser(videoId, valid[0]!.id);

    if (!video || video.length === 0) {
        throw new HttpError(404, 'Video not found');
    }

    const token = generateUploadSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await repository.createUploadSession(videoId, token, expiresAt, expectedSize);

    const objectPath = getObjectPath(randomUUID());
    await repository.createStoredVideo(videoId, objectPath);

    return {
        token
    }
}

export async function openSession(token: string | undefined) {
    const [session] = token ? await repository.getUploadSessionByToken(token) : [];

    if (!session) {
        throw new HttpError(401, 'Invalid upload token');
    }

    if (session.expiresAt < new Date()) {
        throw new HttpError(410, 'Upload session expired');
    }

    if (session.status === 'completed') {
        throw new HttpError(409, 'This video was already uploaded');
    }

    const [claimed] = await repository.claimUploadSession(session.id);

    if (!claimed) {
        throw new HttpError(409, 'An upload for this video is already in progress');
    }

    return claimed;
}

export async function releaseSession(session: UploadSession) {
    await repository.updateUploadSession(session.id, { status: 'pending', receivedSize: 0 });
}

export async function uploadVideo(session: UploadSession, part: MultipartFile) {
    const videoId = session.videoId;
    const [storedVideo] = await repository.getStoredVideoByVideoId(videoId);

    if (!storedVideo) {
        throw new HttpError(404, 'Stored video not found');
    }

    const objectKey = storedVideo.objectKey;
    const objectPath = resolve(STORAGE_ROOT, objectKey);

    const relativePath = relative(STORAGE_ROOT, objectPath);

    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new HttpError(500, 'Invalid object key');
    }

    const tempPath = `${objectPath}.part`;

    let received = 0;
    let lastWrite = 0;
    let pendingWrite: Promise<unknown> = Promise.resolve();

    const tracker = createProgressTracker(session.expectedSize, (_, bytes) => {
        received = bytes;
        const now = Date.now();
        if (now - lastWrite < PROGRESS_WRITE_INTERVAL_MS) return;
        lastWrite = now;
        pendingWrite = pendingWrite
            .then(() => repository.updateUploadSession(session.id, { receivedSize: bytes }))
            .catch(() => { });
    });

    try {
        await mkdir(dirname(objectPath), { recursive: true });
        await rm(tempPath, { force: true });

        await pipeline(
            part.file,
            tracker,
            createWriteStream(tempPath, { flags: 'wx' })
        );

        if (part.file.truncated) {
            throw new HttpError(413, 'Upload is larger than announced');
        }

        await pendingWrite;
        await rename(tempPath, objectPath);
    } catch (error) {
        await pendingWrite;
        await rm(tempPath, { force: true });

        if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
            throw new HttpError(413, 'Upload is larger than announced');
        }
        throw error;
    }

    if (!await repository.completeUpload(session.id, videoId, received)) {
        await rm(objectPath, { force: true });
        throw new HttpError(410, 'This video was deleted during the upload');
    }

    const response = await fetch(`${process.env.TRANSCODER_API_URL}/transcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
        signal: AbortSignal.timeout(10_000)
    }).catch(() => null);

    if (!response?.ok) {
        await repository.setVideoStatus(videoId, 'failed');
        throw new HttpError(502, 'Uploaded, but transcoding could not be started');
    }

    return { success: true, status: 'encoding', videoId };
}
