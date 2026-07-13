from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from uvicorn import Config, Server
from fastapi.responses import JSONResponse
from PIL import Image
import numpy as np
import io


from routers.api import router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

server = Server(
    Config(
        "main:app",
        host="0.0.0.0",
        port=8000,
        proxy_headers=True,
        forwarded_allow_ips="*",
        reload=True,
        server_header=False,
    ),
)

if __name__ == "__main__":
    server.run()
