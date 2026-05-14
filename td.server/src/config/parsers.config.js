import express from 'express';

const config = (app) => {
    // SECURITY: Limit payload size to prevent DoS via oversized requests.
    // Reduced from 50mb — 5mb is sufficient for JSON API payloads.
    // File uploads should use dedicated multipart endpoints.
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ limit: '5mb', extended: true }));
};

export default {
    config
};
