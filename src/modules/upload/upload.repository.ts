import { db } from '@vid2eu/db/client';
import { video, uploadSession, storedVideo, user } from '@vid2eu/db/schema';
import { eq, and } from 'drizzle-orm';

const getVideoById = async (videoId: string) => {
    return await db.select().from(video).where(eq(video.id, videoId));
}

const getVideoByIdWithUser = async (videoId: string, userId: string) => {
    return await db.select().from(video).where(and(eq(video.id, videoId), eq(video.userId, userId)));
}

const createUploadSession = async (videoId: string, token: string, expiresAt: Date, expectedSize: number) => {
    return await db.insert(uploadSession).values({ videoId: videoId, token: token, status: 'pending', expiresAt: expiresAt, expectedSize: expectedSize });
}

const createStoredVideo = async (videoId: string, objectKey: string) => {
    return await db.insert(storedVideo).values({ videoId: videoId, objectKey: objectKey });
}

const getStoredVideoByVideoId = async (videoId: string) => {
    return await db.select().from(storedVideo).where(eq(storedVideo.videoId, videoId));
}

const getUploadSessionByToken = async (token: string) => {
    return await db.select().from(uploadSession).where(eq(uploadSession.token, token));
}

const claimUploadSession = async (id: string) => {
    return await db.update(uploadSession)
        .set({ status: 'uploading', receivedSize: 0, updatedAt: new Date() })
        .where(and(eq(uploadSession.id, id), eq(uploadSession.status, 'pending')))
        .returning();
}

const updateUploadSession = (id: string, values: Partial<{ status: string; expiresAt: Date, expectedSize: number, receivedSize: number }>) => {
    return db.update(uploadSession).set({ ...values, updatedAt: new Date() }).where(eq(uploadSession.id, id));
}

const completeUpload = async (sessionId: string, videoId: string, size: number) => {
    return await db.transaction(async (tx) => {
        const updated = await tx.update(video)
            .set({ status: 'processing' })
            .where(eq(video.id, videoId))
            .returning({ id: video.id });
        if (updated.length === 0) return false;

        await tx.update(uploadSession)
            .set({ status: 'completed', receivedSize: size, updatedAt: new Date() })
            .where(eq(uploadSession.id, sessionId));
        await tx.update(storedVideo).set({ size, status: 'stored' }).where(eq(storedVideo.videoId, videoId));
        return true;
    });
}

const setVideoStatus = async (videoId: string, status: string) => {
    return await db.update(video).set({ status }).where(eq(video.id, videoId));
}

const checkUserValid = async (id: string) => {
    return await db.select().from(user).where(eq(user.id, id));
}

export default {
    getVideoById,
    getVideoByIdWithUser,
    createUploadSession,
    createStoredVideo,
    getStoredVideoByVideoId,
    getUploadSessionByToken,
    claimUploadSession,
    updateUploadSession,
    completeUpload,
    setVideoStatus,
    checkUserValid
}
