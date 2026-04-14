import express from 'express';

const config = (app) => {
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
};

export default {
    config
};
