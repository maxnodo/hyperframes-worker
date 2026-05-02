FROM node:20-alpine

# ffmpeg disponible para el stub de render (y útil para HyperFrames real)
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV WORK_DIR=/tmp/hyperframes

CMD ["node", "src/index.js"]
