import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn import Config, Server

from routers.api import router

app = FastAPI()

IS_DEV = os.environ.get("ENV") == "dev"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"https://.*\.vercel\.app"
        r"|http://localhost:(5173|4200)"
        r"|http://127\.0\.0\.1:(5173|4200)"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


server = Server(
    Config(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        proxy_headers=True,
        forwarded_allow_ips="*",
        reload=IS_DEV,
        server_header=False,
    ),
)

if __name__ == "__main__":
    server.run()
