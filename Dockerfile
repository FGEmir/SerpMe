FROM python:3.12-slim

WORKDIR /app
COPY app.py index.html about.html login.html portfolio.html styles.css liquid.css app.js auth.js login.js portfolio.js supabase-config.js ./

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000
EXPOSE 8000

RUN addgroup --system appuser && adduser --system --ingroup appuser appuser
USER appuser

CMD ["python", "-u", "app.py"]
