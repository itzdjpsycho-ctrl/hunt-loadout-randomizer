FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY app ./app
COPY data ./data
COPY assets ./assets
COPY sources ./sources
COPY scripts/build-web.mjs ./scripts/build-web.mjs
RUN npm run build

FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8000
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server ./server
COPY --from=frontend /app/site ./site
RUN useradd --create-home appuser && mkdir /app/runtime && chown appuser:appuser /app/runtime
USER appuser
EXPOSE 8000
CMD ["python", "-m", "server"]
