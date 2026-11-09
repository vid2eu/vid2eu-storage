declare namespace NodeJS {
    interface ProcessEnv {
        PORT: string;
        POSTGRES_USER: string;
        POSTGRES_PASSWORD: string;
        POSTGRES_DB: string;
        DATABASE_URL: string;
        JWT_SECRET: string;
        STORAGE_ROOT: string;
        TRANSCODER_API_URL: string;
    }
}