FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN echo "COMMIT_HASH=$(git rev-parse --short HEAD)" > /commit_hash.txt
ENV COMMIT_HASH="$(cat /commit_hash.txt)"

CMD ["python", "main.py"] 