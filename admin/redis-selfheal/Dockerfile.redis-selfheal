FROM python:3.11-slim
WORKDIR /app
COPY redis_selfheal.py .
RUN pip install redis
VOLUME ["/logs"]
CMD ["python", "redis_selfheal.py"] 