FROM node:22-bookworm-slim AS graphics
WORKDIR /build
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

FROM python:3.13-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY web ./web
COPY run.py ./
COPY --from=graphics /build/node_modules/three ./node_modules/three
RUN useradd --create-home --uid 10001 zhiye && mkdir -p /app/data && chown -R zhiye:zhiye /app
USER zhiye
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=4)"
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "8000"]
