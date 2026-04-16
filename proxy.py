from flask import Flask, request, Response
import requests

app = Flask(__name__)

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxStroGpakfRoXG4ziS0ttQrEqW6MwsjadRrIXaTVIMJfEt7IrQH6enP6NvlmAk1VP5Zw/exec"

@app.route("/drwc/api", methods=["GET", "POST", "OPTIONS"])
def proxy_root():
    if request.method == "OPTIONS":
        resp = Response()
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    if request.method == "GET":
        resp = requests.get(APPS_SCRIPT_URL, params=request.args)
    else:
        data = request.get_json(silent=True) or {}
        resp = requests.post(APPS_SCRIPT_URL, json=data)

    response = Response(resp.content, status=resp.status_code)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Content-Type"] = resp.headers.get("Content-Type", "application/json")
    return response

if __name__ == "__main__":
    app.run(port=5000, host='0.0.0.0', debug=True)
