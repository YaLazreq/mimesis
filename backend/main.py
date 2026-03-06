from fastapi import FastAPI, WebSocket
import uvicorn

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Connexion établie avec le frontend ! ✅")
    try:
        while True:
            # On attend de recevoir des données de Next.js
            data = await websocket.receive_bytes()
            # C'est ici que nous insérerons l'ADK plus tard
            print(f"Reçu : {len(data)} octets")
    except Exception as e:
        print(f"Connexion fermée : {e}")

if __name__ == "__main__":
    # On lance le serveur sur le port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)