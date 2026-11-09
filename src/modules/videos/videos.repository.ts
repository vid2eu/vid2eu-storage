import { db } from '@vid2eu/db/client';
import { video, videoAsset, storedVideo, uploadSession, processingJob, user } from '@vid2eu/db/schema';
import { eq, inArray } from 'drizzle-orm';

const getUserById = async (id: string) => {
    const [row] = await db.select({ id: user.id, isAdmin: user.isAdmin }).from(user).where(eq(user.id, id));
    return row;
}

const getVideos = async (ids: string[]) => {
    return await db.select({ id: video.id, userId: video.userId }).from(video).where(inArray(video.id, ids));
}

const deleteVideos = async (ids: string[]) => {
    return await db.transaction(async (tx) => {
        const assets = await tx.select({ key: videoAsset.objectKey }).from(videoAsset).where(inArray(videoAsset.videoId, ids));
        const originals = await tx.select({ key: storedVideo.objectKey }).from(storedVideo).where(inArray(storedVideo.videoId, ids));

        await tx.delete(processingJob).where(inArray(processingJob.videoId, ids));
        await tx.delete(videoAsset).where(inArray(videoAsset.videoId, ids));
        await tx.delete(storedVideo).where(inArray(storedVideo.videoId, ids));
        await tx.delete(uploadSession).where(inArray(uploadSession.videoId, ids));
        await tx.delete(video).where(inArray(video.id, ids));

        return [...assets, ...originals].map((row) => row.key);
    });
}

export default {
    getUserById,
    getVideos,
    deleteVideos
}
