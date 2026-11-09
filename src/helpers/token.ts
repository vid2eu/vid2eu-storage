import { randomBytes } from 'crypto';
import { jwtVerify } from 'jose';

export const generateUploadSessionToken = () => {
    const token = randomBytes(32).toString('hex');
    return token;
}

export const verifyJwt = async (token: string) => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    try {
        const { payload } = await jwtVerify<{ userId: string }>(token, secret);
        return payload;
    } catch (err) {
        return null;
    }
}