import { db } from '@vid2eu/db/client'
import { video, videoAsset, type VideoAssetType } from '@vid2eu/db/schema'
import { eq, and } from 'drizzle-orm';

const getVideoById = async (id: string) => {
    return await db.select().from(video).where(eq(video.id, id));
}

const getVideoAssetByVideoIdAndVersion = async (videoId: string, version: VideoAssetType) => {
    return await db.select().from(videoAsset).where(and(eq(videoAsset.videoId, videoId), eq(videoAsset.type, version)));
}

export default {
    getVideoById,
    getVideoAssetByVideoIdAndVersion
}