FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY core ./core
COPY server ./server
COPY scripts ./scripts
COPY public ./public
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/graph-lab.sqlite
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
