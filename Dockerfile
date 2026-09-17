FROM node:20-slim

# Install system dependencies: ffmpeg + curl for yt-dlp download
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    python3 \
    --no-install-recommends \
    && update-ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install the latest standalone yt-dlp (using python3 for robustness). Not the plain
# `yt-dlp` zipapp: it lacks curl_cffi, and sites such as Dailymotion refuse requests
# that don't impersonate a browser.
RUN python3 -c "import urllib.request; urllib.request.urlretrieve('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux', '/usr/local/bin/yt-dlp')" \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build web frontend and server
RUN npm run build:web

# Expose the server port
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Start the server
CMD ["npm", "run", "start:web"]
