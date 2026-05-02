FROM node:20-slim

# ffmpeg disponible para el stub de render (y útil para HyperFrames real)
RUN apt-get update && apt-get install -y \
  ffmpeg \
  fonts-dejavu-core \
  fontconfig \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV WORK_DIR=/tmp/hyperframes

CMD ["node", "src/index.js"]
