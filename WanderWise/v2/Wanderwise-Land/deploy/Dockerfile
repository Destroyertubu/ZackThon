FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd -m -u 10001 wanderwise
COPY backend/ backend/
COPY frontend/ frontend/
COPY demo-data/ demo-data/
COPY start.py ./
COPY tools/backup.py tools/backup.py
RUN mkdir -p /app/data && chown -R wanderwise:wanderwise /app
USER wanderwise
ENV PYTHONUNBUFFERED=1 WANDERWISE_DB=/app/data/wanderwise.sqlite3
VOLUME /app/data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/ready',timeout=2)"
CMD ["python","start.py","--use-current","--no-install","--host","0.0.0.0","--port","8000","--no-browser"]
