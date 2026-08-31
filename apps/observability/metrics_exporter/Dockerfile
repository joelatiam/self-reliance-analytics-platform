FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Every module, not just app.py: the exporter is three files now and a
# missing one fails at import time, after the image builds cleanly.
COPY *.py ./
EXPOSE 9105
CMD ["python", "app.py"]
