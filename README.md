postgresql:
docker run --name exam-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=exam_db -p 5432:5432 -d postgres:16