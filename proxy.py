from flask import Flask, request, Response
import requests

app = Flask(__name__)

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxStroGpakfRoXG4ziS0ttQrEqW6MwsjadRrIXaTVIMJfEt7IrQH6enP6NvlmAk1VP5Zw/exec"

@app.route("/api", methods=["GET", "POST", "OPTIONS"])
def proxy_root():
    # 1. Handle CORS Preflight for the browser
    if request.method == "OPTIONS":
        resp = Response()
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    # 2. Forward the request to Google Apps Script
    if request.method == "GET":
        resp = requests.get(APPS_SCRIPT_URL, params=request.args)
    else:
        # Get raw data since JS sends text/plain to bypass complex CORS
        data = request.get_data()
        resp = requests.post(
            APPS_SCRIPT_URL, 
            data=data, 
            headers={'Content-Type': 'application/json'}
        )

    # 3. Return Google's response back to your JS
    response = Response(resp.content, status=resp.status_code)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Content-Type"] = "application/json" # Ensure JS can .json() this
    return response

if __name__ == "__main__":
    app.run(port=5000, host='0.0.0.0', debug=True)
